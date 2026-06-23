import {useState, useCallback, useRef, useEffect} from 'react'
import {SearchHistory, GetHistoryAudio, DeleteHistory, ClearHistory} from '../lib/backend'
import {ModelType, SynthesisTask} from '../types'

const PAGE_SIZE = 20

export function useHistory() {
    const [tasks, setTasks] = useState<SynthesisTask[]>([])
    const tasksRef = useRef(tasks)
    useEffect(() => { tasksRef.current = tasks }, [tasks])
    const [historyTotal, setHistoryTotal] = useState(0)
    const [historyPage, setHistoryPage] = useState(1)
    const [historySearch, setHistorySearch] = useState('')
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

    const loadHistory = useCallback(async (query: string, page: number) => {
        try {
            const offset = (page - 1) * PAGE_SIZE
            const result = await SearchHistory(query, offset, PAGE_SIZE)
            const loadedTasks: SynthesisTask[] = result.items.map(item => ({
                id: `db-${item.id}`,
                text: item.text,
                model: item.model as ModelType,
                voice: item.voice,
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
        } catch (e) {
            console.error('Failed to load history:', e)
        }
    }, [])

    const searchHistory = useCallback((query: string) => {
        setHistorySearch(query)
        loadHistory(query, 1)
    }, [loadHistory])

    const changePage = useCallback((page: number) => {
        loadHistory(historySearch, page)
    }, [loadHistory, historySearch])

    const addTask = useCallback((task: SynthesisTask) => {
        setTasks(prev => [task, ...prev])
    }, [])

    const updateTask = useCallback((taskId: string, updates: Partial<SynthesisTask>) => {
        setTasks(prev => prev.map(t => t.id === taskId ? {...t, ...updates} : t))
    }, [])

    const deleteTask = useCallback(async (taskId: string, playingTaskId: string | null, stopAudio: () => void) => {
        if (playingTaskId === taskId) stopAudio()
        setTasks(prev => {
            const task = prev.find(t => t.id === taskId)
            if (task?.dbId) DeleteHistory(task.dbId).catch(console.error)
            return prev.filter(t => t.id !== taskId)
        })
        setHistoryTotal(prev => Math.max(0, prev - 1))
    }, [])

    const clearCompleted = useCallback(async (playingTaskId: string | null, stopAudio: () => void, isPlaying: (id: string) => boolean) => {
        if (playingTaskId && isPlaying(playingTaskId)) stopAudio()
        ClearHistory().catch(console.error)
        setTasks(prev => prev.filter(t => t.status !== 'completed'))
        setHistoryTotal(0)
        setHistoryPage(1)
    }, [])

    const loadAudio = useCallback(async (taskId: string) => {
        const task = tasksRef.current.find(t => t.id === taskId)
        if (!task?.dbId || task.audioBlob) return
        try {
            const blob = await GetHistoryAudio(task.dbId)
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, audioBlob: blob} : t))
        } catch (e) {
            console.error('Failed to load audio:', e)
            // 加载失败时标记为无音频，避免一直显示加载中
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, hasAudio: false} : t))
        }
    }, [])

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
