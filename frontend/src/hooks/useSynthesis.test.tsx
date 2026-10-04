import {act, renderHook, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {SynthesisInput, useSynthesis} from './useSynthesis'

const backendMocks = vi.hoisted(() => ({
    cancelSynthesis: vi.fn(),
    saveToHistory: vi.fn(),
    synthesizeSpeech: vi.fn(),
    synthesizeSpeechStream: vi.fn(),
}))

vi.mock('../lib/backend', async importOriginal => {
    const actual = await importOriginal<typeof import('../lib/backend')>()
    return {
        ...actual,
        CancelSynthesis: backendMocks.cancelSynthesis,
        SaveToHistory: backendMocks.saveToHistory,
        SynthesizeSpeech: backendMocks.synthesizeSpeech,
        SynthesizeSpeechStream: backendMocks.synthesizeSpeechStream,
    }
})

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return {promise, resolve, reject}
}

const input: SynthesisInput = {
    text: 'hello',
    model: 'mimo-v2.5-tts',
    voice: 'mimo_default',
    style: '',
}

function createCallbacks() {
    return {
        addTask: vi.fn(),
        updateTask: vi.fn(),
        incrementTotal: vi.fn(),
        playAudio: vi.fn(),
    }
}

class FakeAudioContext {
    static instances: FakeAudioContext[] = []
    state: AudioContextState = 'running'
    currentTime = 0
    destination = {} as AudioDestinationNode
    readonly sourceStarts: number[] = []
    readonly close = vi.fn(async () => { this.state = 'closed' })
    readonly resume = vi.fn(async () => { this.state = 'running' })
    readonly suspend = vi.fn(async () => { this.state = 'suspended' })

    constructor() {
        FakeAudioContext.instances.push(this)
    }

    createBuffer() {
        return {
            duration: 5,
            getChannelData: () => new Float32Array(1),
        } as unknown as AudioBuffer
    }

    createBufferSource() {
        return {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn((when?: number) => this.sourceStarts.push(when || 0)),
        } as unknown as AudioBufferSourceNode
    }
}

describe('useSynthesis state machine', () => {
    beforeEach(() => {
        FakeAudioContext.instances = []
        backendMocks.cancelSynthesis.mockResolvedValue(undefined)
        backendMocks.saveToHistory.mockResolvedValue(undefined)
        vi.stubGlobal('AudioContext', FakeAudioContext)
    })

    it('rejects a concurrent operation and cancellation prevents later completion', async () => {
        const response = deferred<{audioData: string; format: string; error: string}>()
        backendMocks.synthesizeSpeech.mockReturnValueOnce(response.promise)
        const callbacks = createCallbacks()
        const {result} = renderHook(() => useSynthesis(
            callbacks.addTask,
            callbacks.updateTask,
            callbacks.incrementTotal,
            callbacks.playAudio,
        ))

        let first!: Promise<boolean>
        let second!: Promise<boolean>
        act(() => {
            first = result.current.synthesize(input)
            second = result.current.synthesizeStream(input)
        })

        await expect(second).resolves.toBe(false)
        expect(backendMocks.synthesizeSpeech).toHaveBeenCalledTimes(1)
        expect(backendMocks.synthesizeSpeechStream).not.toHaveBeenCalled()
        expect(callbacks.addTask).toHaveBeenCalledTimes(1)

        act(() => result.current.cancelSynthesize())
        expect(backendMocks.cancelSynthesis).toHaveBeenCalledTimes(1)
        response.resolve({audioData: 'AAE=', format: 'wav', error: ''})
        await act(async () => { await first })

        expect(callbacks.updateTask).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({status: 'completed'}),
        )
        expect(callbacks.playAudio).not.toHaveBeenCalled()
        expect(backendMocks.saveToHistory).not.toHaveBeenCalled()
        expect(result.current.phase).toBe('idle')
    })

    it('cancels during scheduled stream playback without marking the task completed', async () => {
        backendMocks.synthesizeSpeechStream.mockImplementationOnce(() => (async function* () {
            yield new Uint8Array([0, 0])
        })())
        const callbacks = createCallbacks()
        const {result} = renderHook(() => useSynthesis(
            callbacks.addTask,
            callbacks.updateTask,
            callbacks.incrementTotal,
            callbacks.playAudio,
        ))

        let streamResult!: Promise<boolean>
        act(() => {
            streamResult = result.current.synthesizeStream(input)
        })
        await waitFor(() => expect(result.current.phase).toBe('finishing'))
        act(() => result.current.cancelStream())
        await act(async () => { await streamResult })

        expect(callbacks.updateTask).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({status: 'completed'}),
        )
        expect(callbacks.incrementTotal).not.toHaveBeenCalled()
        expect(backendMocks.saveToHistory).not.toHaveBeenCalled()
        expect(result.current.phase).toBe('idle')
    })

    it.each([
        ['no audio', []],
        ['odd PCM16 audio', [new Uint8Array([0])]],
    ])('rejects a stream with %s', async (_name, chunks) => {
        backendMocks.synthesizeSpeechStream.mockImplementationOnce(() => (async function* () {
            for (const chunk of chunks) yield chunk
        })())
        const callbacks = createCallbacks()
        const {result} = renderHook(() => useSynthesis(
            callbacks.addTask,
            callbacks.updateTask,
            callbacks.incrementTotal,
            callbacks.playAudio,
        ))

        let succeeded = true
        await act(async () => {
            succeeded = await result.current.synthesizeStream(input)
        })

        expect(succeeded).toBe(false)
        expect(callbacks.updateTask).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({status: 'error'}),
        )
        expect(callbacks.incrementTotal).not.toHaveBeenCalled()
        expect(backendMocks.saveToHistory).not.toHaveBeenCalled()
    })

    it('aborts and closes AudioContext on route-style unmount', async () => {
        const streamGate = deferred<void>()
        let receivedSignal: AbortSignal | undefined
        backendMocks.synthesizeSpeechStream.mockImplementationOnce((_, signal: AbortSignal) => {
            receivedSignal = signal
            return (async function* () {
                await streamGate.promise
                yield new Uint8Array([0, 0])
            })()
        })
        const callbacks = createCallbacks()
        const {result, unmount} = renderHook(() => useSynthesis(
            callbacks.addTask,
            callbacks.updateTask,
            callbacks.incrementTotal,
            callbacks.playAudio,
        ))

        let streamResult!: Promise<boolean>
        act(() => {
            streamResult = result.current.synthesizeStream(input)
        })
        await waitFor(() => expect(FakeAudioContext.instances).toHaveLength(1))
        unmount()

        expect(receivedSignal?.aborted).toBe(true)
        expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1)
        streamGate.resolve()
        await act(async () => { await streamResult })
        expect(callbacks.updateTask).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({status: 'completed'}),
        )
        expect(backendMocks.saveToHistory).not.toHaveBeenCalled()
    })

    it('rebases streamed playback after a network stall', async () => {
        backendMocks.synthesizeSpeechStream.mockImplementationOnce(() => (async function* () {
            const audioContext = FakeAudioContext.instances[0]
            audioContext.currentTime = 12
            yield new Uint8Array([0, 0])
        })())
        const callbacks = createCallbacks()
        const {result} = renderHook(() => useSynthesis(
            callbacks.addTask,
            callbacks.updateTask,
            callbacks.incrementTotal,
            callbacks.playAudio,
        ))

        let streamResult!: Promise<boolean>
        act(() => {
            streamResult = result.current.synthesizeStream(input)
        })
        await waitFor(() => expect(FakeAudioContext.instances[0]?.sourceStarts).toEqual([12]))
        act(() => result.current.cancelStream())
        await act(async () => { await streamResult })
    })
})
