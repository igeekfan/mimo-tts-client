import {useState, useCallback, useRef, useEffect} from 'react'
import {SearchHistory, GetHistoryAudio, DeleteHistory, ClearHistory, BackendError, getErrorMessage} from '../lib/backend'
import {ModelType, SynthesisTask} from '../types'
import {sanitizeVoiceLabel} from '../lib/voiceData'
import {toast} from 'sonner'
import {useI18n} from '../i18n/context'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
}

export function useHistory() {
    const {t} = useI18n()
    const [tasks, setTasks] = useState<SynthesisTask[]>([])
    const tasksRef = useRef(tasks)
    useEffect(() => { tasksRef.current = tasks }, [tasks])
    const [historyTotal, setHistoryTotal] = useState(0)
    const [historyPage, setHistoryPage] = useState(1)
    const [historySearch, setHistorySearch] = useState('')
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const requestSequenceRef = useRef(0)
    const requestAbortRef = useRef<AbortController | null>(null)
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const audioLoadsRef = useRef(new Map<string, Promise<void>>())

    const cancelHistoryLoad = useCallback(() => {
        requestSequenceRef.current++
        requestAbortRef.current?.abort()
        requestAbortRef.current = null
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
            searchTimerRef.current = null
        }
    }, [])

    useEffect(() => cancelHistoryLoad, [cancelHistoryLoad])

    const loadHistory = useCallback(async (query: string, page: number) => {
        const requestSequence = ++requestSequenceRef.current
        requestAbortRef.current?.abort()
        const abortController = new AbortController()
        requestAbortRef.current = abortController
        setHistorySearch(query)

        try {
            const offset = (page - 1) * PAGE_SIZE
            const result = await SearchHistory(query, offset, PAGE_SIZE, abortController.signal)
            if (abortController.signal.aborted || requestSequence !== requestSequenceRef.current) return

            const loadedTasks: SynthesisTask[] = result.items.map(item => ({
                id: `db-${item.id}`,
                text: item.text,
                model: item.model as ModelType,
                voice: sanitizeVoiceLabel(item.voice, 'voice-clone'),
                style: item.style || undefined,
                status: 'completed' as const,
                progress: 100,
                hasAudio: item.hasAudio,
                createdAt: item.createdAt,
                dbId: item.id,
            }))
            setTasks(loadedTasks)
            setHistoryTotal(result.total)
            setHistoryPage(page)
            setExpandedTaskId(null)
        } catch (error) {
            if (!isAbortError(error) && requestSequence === requestSequenceRef.current) {
                console.error('Failed to load history:', error)
            }
        } finally {
            if (requestAbortRef.current === abortController) requestAbortRef.current = null
        }
    }, [])

    const searchHistory = useCallback((query: string) => {
        setHistorySearch(query)
        requestSequenceRef.current++
        requestAbortRef.current?.abort()
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => {
            searchTimerRef.current = null
            void loadHistory(query, 1)
        }, SEARCH_DEBOUNCE_MS)
    }, [loadHistory])

    const changePage = useCallback((page: number) => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current)
            searchTimerRef.current = null
        }
        void loadHistory(historySearch, page)
    }, [loadHistory, historySearch])

    const addTask = useCallback((task: SynthesisTask) => {
        setTasks(prev => [task, ...prev])
    }, [])

    const updateTask = useCallback((taskId: string, updates: Partial<SynthesisTask>) => {
        setTasks(prev => prev.map(task => task.id === taskId ? {...task, ...updates} : task))
    }, [])

    const deleteTask = useCallback(async (taskId: string, playingTaskId: string | null, stopAudio: () => void) => {
        const task = tasksRef.current.find(candidate => candidate.id === taskId)
        if (!task) return
        if (task.dbId) await DeleteHistory(task.dbId)
        if (playingTaskId === taskId) stopAudio()
        setTasks(prev => prev.filter(candidate => candidate.id !== taskId))
        if (task.dbId) setHistoryTotal(prev => Math.max(0, prev - 1))
    }, [])

    const clearCompleted = useCallback(async (
        playingTaskId: string | null,
        stopAudio: () => void,
        isPlaying: (id: string) => boolean,
    ) => {
        await ClearHistory()
        if (playingTaskId && isPlaying(playingTaskId)) stopAudio()
        setTasks(prev => prev.filter(task => task.status !== 'completed'))
        setHistoryTotal(0)
        setHistoryPage(1)
        setExpandedTaskId(null)
    }, [])

    const loadAudio = useCallback((taskId: string): Promise<void> => {
        const existingLoad = audioLoadsRef.current.get(taskId)
        if (existingLoad) return existingLoad

        const task = tasksRef.current.find(candidate => candidate.id === taskId)
        if (!task?.dbId || task.audioBlob || task.hasAudio === false) return Promise.resolve()

        const load = (async () => {
            try {
                const blob = await GetHistoryAudio(task.dbId!)
                setTasks(prev => prev.map(candidate => candidate.id === taskId ? {...candidate, audioBlob: blob, audioError: undefined} : candidate))
            } catch (error) {
                console.error('Failed to load audio:', error)
                const permanentlyMissing = error instanceof BackendError && error.status === 404
                setTasks(prev => prev.map(candidate => candidate.id === taskId ? {
                    ...candidate,
                    hasAudio: permanentlyMissing ? false : candidate.hasAudio,
                    audioError: permanentlyMissing ? undefined : getErrorMessage(error),
                } : candidate))
                if (!permanentlyMissing) toast.error(`${t('history.audioLoadFailed')}: ${getErrorMessage(error)}`)
            } finally {
                audioLoadsRef.current.delete(taskId)
            }
        })()
        audioLoadsRef.current.set(taskId, load)
        return load
    }, [t])

    const incrementTotal = useCallback(() => {
        setHistoryTotal(prev => prev + 1)
    }, [])

    return {
        tasks,
        historyTotal,
        historyPage,
        historySearch,
        expandedTaskId,
        setExpandedTaskId,
        loadHistory,
        cancelHistoryLoad,
        searchHistory,
        changePage,
        addTask,
        updateTask,
        deleteTask,
        clearCompleted,
        loadAudio,
        incrementTotal,
    }
}
