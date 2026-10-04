import {act, renderHook, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useHistory} from './useHistory'
import {BackendError} from '../lib/backend'

const backendMocks = vi.hoisted(() => ({
    getHistoryAudio: vi.fn(),
    searchHistory: vi.fn(),
}))

vi.mock('../lib/backend', async importOriginal => {
    const actual = await importOriginal<typeof import('../lib/backend')>()
    return {
        ...actual,
        ClearHistory: vi.fn(),
        DeleteHistory: vi.fn(),
        GetHistoryAudio: backendMocks.getHistoryAudio,
        SearchHistory: backendMocks.searchHistory,
    }
})

vi.mock('sonner', () => ({toast: {error: vi.fn()}}))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return {promise, resolve, reject}
}

describe('useHistory request lifecycle', () => {
    beforeEach(() => {
        backendMocks.getHistoryAudio.mockReset()
        backendMocks.searchHistory.mockReset()
    })

    it('does not let a late history response replace a new live task after route cleanup', async () => {
        const response = deferred<{
            items: never[]
            total: number
            offset: number
            limit: number
        }>()
        backendMocks.searchHistory.mockReturnValueOnce(response.promise)
        const {result} = renderHook(() => useHistory())

        let load!: Promise<void>
        act(() => {
            load = result.current.loadHistory('', 1)
        })
        act(() => {
            result.current.cancelHistoryLoad()
            result.current.addTask({
                id: 'live-1',
                text: 'new synthesis',
                model: 'mimo-v2.5-tts',
                voice: 'mimo_default',
                status: 'synthesizing',
                progress: 0,
                createdAt: new Date().toISOString(),
            })
        })
        response.resolve({items: [], total: 0, offset: 0, limit: 20})
        await act(async () => { await load })

        expect(result.current.tasks).toHaveLength(1)
        expect(result.current.tasks[0].id).toBe('live-1')
    })

    it('deduplicates audio loads and retries a transient failure', async () => {
        backendMocks.searchHistory.mockResolvedValue({
            items: [{
                id: 7,
                text: 'saved task',
                model: 'mimo-v2.5-tts',
                voice: 'mimo_default',
                style: '',
                format: 'wav',
                hasAudio: true,
                createdAt: new Date().toISOString(),
            }],
            total: 1,
            offset: 0,
            limit: 20,
        })
        const failedLoad = deferred<Blob>()
        backendMocks.getHistoryAudio.mockReturnValueOnce(failedLoad.promise)
        backendMocks.getHistoryAudio.mockResolvedValueOnce(new Blob(['audio'], {type: 'audio/wav'}))
        const {result} = renderHook(() => useHistory())
        await act(async () => { await result.current.loadHistory('', 1) })

        let first!: Promise<void>
        let duplicate!: Promise<void>
        act(() => {
            first = result.current.loadAudio('db-7')
            duplicate = result.current.loadAudio('db-7')
        })
        expect(first).toBe(duplicate)
        expect(backendMocks.getHistoryAudio).toHaveBeenCalledTimes(1)
        failedLoad.reject(new BackendError('temporary outage', 503, 'HTTP_503'))
        await act(async () => { await first })

        expect(result.current.tasks[0].hasAudio).toBe(true)
        expect(result.current.tasks[0].audioError).toBe('temporary outage')
        await act(async () => { await result.current.loadAudio('db-7') })
        await waitFor(() => expect(result.current.tasks[0].audioBlob).toBeInstanceOf(Blob))
        expect(backendMocks.getHistoryAudio).toHaveBeenCalledTimes(2)
    })
})
