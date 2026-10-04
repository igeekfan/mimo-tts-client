import {useState, useRef, useCallback, useEffect} from 'react'
import {
    BackendError,
    CancelSynthesis,
    getErrorMessage,
    SaveToHistory,
    SynthesizeSpeech,
    SynthesizeSpeechStream,
} from '../lib/backend'
import {SynthesisRequest, SynthesisTask} from '../types'
import {createTaskId, addWavHeader} from '../lib/audioUtils'
import {sanitizeVoiceLabel} from '../lib/voiceData'
import {useI18n} from '../i18n/context'
import {toast} from 'sonner'

export type SynthesisMode = 'standard' | 'stream'
export type SynthesisPhase = 'idle' | 'requesting' | 'streaming' | 'paused' | 'finishing'
export type SynthesisInput = Omit<SynthesisRequest, 'requestId'>

type SynthesisState = {
    mode: SynthesisMode | null
    phase: SynthesisPhase
}

type ActiveOperation = {
    operationId: string
    taskId: string
    request: SynthesisRequest
    mode: SynthesisMode
    controller: AbortController
    audioContext: AudioContext | null
    cancelled: boolean
    paused: boolean
    streamFinished: boolean
    cancelMessage: string
}

const IDLE_STATE: SynthesisState = {mode: null, phase: 'idle'}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
}

function createOperationId(mode: SynthesisMode): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${mode}_${crypto.randomUUID()}`
    }
    return `${mode}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function waitForAbortableDelay(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
        }
        signal.addEventListener('abort', onAbort, {once: true})
    })
}

async function closeAudioContext(operation: ActiveOperation): Promise<void> {
    const audioContext = operation.audioContext
    operation.audioContext = null
    if (!audioContext || audioContext.state === 'closed') return
    try {
        await audioContext.close()
    } catch {
    }
}

async function waitForScheduledAudio(
    audioContext: AudioContext,
    endTime: number,
    signal: AbortSignal,
): Promise<void> {
    while (endTime - audioContext.currentTime > 0.02) {
        const remainingMs = (endTime - audioContext.currentTime) * 1000
        await waitForAbortableDelay(Math.min(100, Math.max(10, remainingMs)), signal)
    }
}

function decodeAudioData(audioData: string): Uint8Array {
    const binaryString = atob(audioData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    return bytes
}

export function useSynthesis(
    addTask: (task: SynthesisTask) => void,
    updateTask: (taskId: string, updates: Partial<SynthesisTask>) => void,
    incrementTotal: () => void,
    playAudio: (task: SynthesisTask) => void,
) {
    const {t} = useI18n()
    const [state, setState] = useState<SynthesisState>(IDLE_STATE)
    const operationRef = useRef<ActiveOperation | null>(null)
    const mountedRef = useRef(true)

    const isCurrentOperation = useCallback((operation: ActiveOperation) => {
        return operationRef.current === operation && !operation.cancelled && !operation.controller.signal.aborted
    }, [])

    const finishOperation = useCallback((operation: ActiveOperation) => {
        if (operationRef.current !== operation) return
        operationRef.current = null
        if (mountedRef.current) setState(IDLE_STATE)
    }, [])

    const cancelOperation = useCallback((operation: ActiveOperation, updateReactState: boolean) => {
        if (operation.cancelled) return
        operation.cancelled = true
        operation.paused = false
        operation.controller.abort()
        if (operation.mode === 'standard') {
            void CancelSynthesis(operation.request.requestId).catch(error => {
                console.error('Failed to cancel desktop synthesis:', error)
            })
        }
        void closeAudioContext(operation)
        updateTask(operation.taskId, {status: 'error', error: operation.cancelMessage})
        if (operationRef.current === operation) operationRef.current = null
        if (updateReactState && mountedRef.current) setState(IDLE_STATE)
    }, [updateTask])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            const operation = operationRef.current
            if (operation) cancelOperation(operation, false)
        }
    }, [cancelOperation])

    const beginOperation = useCallback((mode: SynthesisMode, input: SynthesisInput): ActiveOperation | null => {
        if (operationRef.current) return null
        if (!input.text.trim()) {
            toast.error(t('synthesis.enterText'))
            return null
        }
        if (input.model === 'mimo-v2.5-tts-voiceclone' && !input.cloneAudioData) {
            toast.error(t('voice.cloneRequired'))
            return null
        }

        const operationId = createOperationId(mode)
        const taskId = createTaskId()
        const safeVoice = sanitizeVoiceLabel(input.voice, 'voice-clone')
        const request: SynthesisRequest = {
            ...input,
            requestId: operationId,
            voice: safeVoice,
        }
        const operation: ActiveOperation = {
            operationId,
            taskId,
            request,
            mode,
            controller: new AbortController(),
            audioContext: null,
            cancelled: false,
            paused: false,
            streamFinished: false,
            cancelMessage: t('synthesis.cancelled'),
        }
        operationRef.current = operation
        addTask({
            id: taskId,
            text: request.text,
            model: request.model,
            voice: safeVoice,
            style: request.style || undefined,
            status: 'synthesizing',
            progress: 0,
            createdAt: new Date().toISOString(),
        })
        setState({mode, phase: mode === 'stream' ? 'streaming' : 'requesting'})
        return operation
    }, [addTask, t])

    const synthesize = useCallback(async (input: SynthesisInput): Promise<boolean> => {
        const operation = beginOperation('standard', input)
        if (!operation) return false

        try {
            const result = await SynthesizeSpeech(operation.request, operation.controller.signal)
            if (!isCurrentOperation(operation)) return false
            if (result.error) throw new BackendError(result.error, 0, 'SYNTHESIS_ERROR')

            const bytes = decodeAudioData(result.audioData)
            const blob = new Blob([bytes.buffer as ArrayBuffer], {type: 'audio/wav'})
            if (!isCurrentOperation(operation)) return false

            const completedTask: SynthesisTask = {
                id: operation.taskId,
                text: operation.request.text,
                model: operation.request.model,
                voice: operation.request.voice,
                style: operation.request.style || undefined,
                status: 'completed',
                progress: 100,
                audioBlob: blob,
                hasAudio: true,
                createdAt: new Date().toISOString(),
            }
            updateTask(operation.taskId, {status: 'completed', progress: 100, audioBlob: blob, hasAudio: true})
            incrementTotal()
            toast.success(t('synthesis.completed'))
            playAudio(completedTask)
            void SaveToHistory(
                operation.request.text,
                operation.request.model,
                operation.request.voice,
                operation.request.style || '',
                result.audioData,
                'wav',
            ).catch(console.error)
            return true
        } catch (error) {
            if (operation.cancelled || isAbortError(error)) return false
            if (isCurrentOperation(operation)) {
                const message = getErrorMessage(error)
                updateTask(operation.taskId, {status: 'error', error: message})
                toast.error(message)
            }
            return false
        } finally {
            finishOperation(operation)
        }
    }, [beginOperation, finishOperation, incrementTotal, isCurrentOperation, playAudio, t, updateTask])

    const synthesizeStream = useCallback(async (input: SynthesisInput): Promise<boolean> => {
        const operation = beginOperation('stream', input)
        if (!operation) return false

        try {
            const audioContext = new AudioContext({sampleRate: 24000})
            operation.audioContext = audioContext
            await audioContext.resume()
            if (!isCurrentOperation(operation)) return false

            const pcmChunks: Uint8Array[] = []
            let totalLength = 0
            let nextStartTime = audioContext.currentTime + 0.1
            let lastProgressUpdate = 0

            for await (const chunk of SynthesizeSpeechStream(operation.request, operation.controller.signal)) {
                if (!isCurrentOperation(operation)) return false
                if (chunk.length === 0 || chunk.length % 2 !== 0) {
                    throw new BackendError('Stream returned invalid PCM16 audio', 0, 'STREAM_INVALID_AUDIO')
                }
                while (operation.paused) {
                    await waitForAbortableDelay(100, operation.controller.signal)
                    if (!isCurrentOperation(operation)) return false
                }

                pcmChunks.push(chunk)
                totalLength += chunk.length
                const float32Chunk = new Float32Array(chunk.length / 2)
                for (let i = 0; i < chunk.length; i += 2) {
                    const sample = chunk[i] | (chunk[i + 1] << 8)
                    float32Chunk[i / 2] = (sample < 32768 ? sample : sample - 65536) / 32768
                }
                const buffer = audioContext.createBuffer(1, float32Chunk.length, 24000)
                buffer.getChannelData(0).set(float32Chunk)
                const source = audioContext.createBufferSource()
                source.buffer = buffer
                source.connect(audioContext.destination)
                // Network stalls can move currentTime beyond the previous
                // schedule. Rebase so the final playback wait includes this
                // chunk instead of closing the AudioContext immediately.
                const chunkStartTime = Math.max(nextStartTime, audioContext.currentTime)
                source.start(chunkStartTime)
                nextStartTime = chunkStartTime + buffer.duration

                const now = Date.now()
                if (now - lastProgressUpdate > 300) {
                    updateTask(operation.taskId, {progress: Math.min(90, totalLength / 1000)})
                    lastProgressUpdate = now
                }
            }

            if (!isCurrentOperation(operation)) return false
            if (totalLength === 0) {
                throw new BackendError('Stream ended without audio', 0, 'STREAM_NO_AUDIO')
            }
            const fullPcm = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of pcmChunks) {
                fullPcm.set(chunk, offset)
                offset += chunk.length
            }
            const wavData = addWavHeader(fullPcm)
            const blob = new Blob([wavData.buffer as ArrayBuffer], {type: 'audio/wav'})
            operation.streamFinished = true
            if (mountedRef.current) setState({mode: 'stream', phase: 'finishing'})
            await waitForScheduledAudio(audioContext, nextStartTime, operation.controller.signal)
            if (!isCurrentOperation(operation)) return false
            await closeAudioContext(operation)
            if (!isCurrentOperation(operation)) return false

            updateTask(operation.taskId, {status: 'completed', progress: 100, audioBlob: blob, hasAudio: true})
            incrementTotal()
            toast.success(t('synthesis.completed'))
            void SaveToHistory(
                operation.request.text,
                operation.request.model,
                operation.request.voice,
                operation.request.style || '',
                wavData,
                'wav',
            ).catch(console.error)
            return true
        } catch (error) {
            if (operation.cancelled || isAbortError(error)) return false
            if (isCurrentOperation(operation)) {
                const message = getErrorMessage(error)
                updateTask(operation.taskId, {status: 'error', error: message})
                toast.error(message)
            }
            return false
        } finally {
            await closeAudioContext(operation)
            finishOperation(operation)
        }
    }, [beginOperation, finishOperation, incrementTotal, isCurrentOperation, t, updateTask])

    const toggleStreamPause = useCallback(async () => {
        const operation = operationRef.current
        if (!operation || operation.mode !== 'stream' || !operation.audioContext) return
        const nextPaused = !operation.paused
        operation.paused = nextPaused
            if (mountedRef.current) {
                setState({mode: 'stream', phase: nextPaused ? 'paused' : operation.streamFinished ? 'finishing' : 'streaming'})
            }
        try {
            if (nextPaused) await operation.audioContext.suspend()
            else await operation.audioContext.resume()
        } catch (error) {
            if (!isCurrentOperation(operation)) return
            operation.paused = !nextPaused
            if (mountedRef.current) {
                setState({
                    mode: 'stream',
                    phase: operation.paused ? 'paused' : operation.streamFinished ? 'finishing' : 'streaming',
                })
            }
            toast.error(getErrorMessage(error))
        }
    }, [isCurrentOperation])

    const cancelSynthesize = useCallback(() => {
        const operation = operationRef.current
        if (operation?.mode === 'standard') cancelOperation(operation, true)
    }, [cancelOperation])

    const cancelStream = useCallback(() => {
        const operation = operationRef.current
        if (operation?.mode === 'stream') cancelOperation(operation, true)
    }, [cancelOperation])

    const isSynthesizing = state.mode === 'standard'
    const isStreaming = state.mode === 'stream'

    return {
        phase: state.phase,
        isBusy: state.phase !== 'idle',
        isSynthesizing,
        isStreaming,
        isStreamPaused: state.phase === 'paused',
        synthesize,
        synthesizeStream,
        toggleStreamPause,
        cancelSynthesize,
        cancelStream,
    }
}
