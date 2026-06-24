import {useCallback, useMemo, useEffect} from 'react'
import {useI18n} from '../i18n/context'
import {SynthesisTask} from '../types'
import {isLoadingAudio as checkIsLoadingAudio} from '../lib/audioUtils'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Pagination} from '@/components/ui/pagination'
import {Trash2, History, ArrowRight} from 'lucide-react'
import HistoryTaskItem from './HistoryTaskItem'
import AudioPlayer from './AudioPlayer'

interface HistoryPanelProps {
    tasks: SynthesisTask[]
    historyTotal: number
    historyPage: number
    historyPageSize: number
    historySearch: string
    onHistorySearch: (query: string) => void
    onPageChange: (page: number) => void
    expandedTaskId: string | null
    setExpandedTaskId: (id: string | null) => void
    playingTaskId: string | null
    isPlaying: boolean
    currentTime: number
    duration: number
    onPlay: (task: SynthesisTask) => void
    onTogglePlay: () => void
    onStop: () => void
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    onDelete: (taskId: string) => void
    onClearCompleted: () => void
    onDownload: (task: SynthesisTask) => void
    onLoadAudio: (taskId: string) => void
    onNavigateToSynthesis?: () => void
}

export default function HistoryPanel({
    tasks, historyTotal, historyPage, historyPageSize,
    historySearch, onHistorySearch, onPageChange,
    expandedTaskId, setExpandedTaskId,
    playingTaskId, isPlaying, currentTime, duration,
    onPlay, onTogglePlay, onStop, onSeek, onDelete, onClearCompleted, onDownload, onLoadAudio,
    onNavigateToSynthesis
}: HistoryPanelProps) {
    const {t} = useI18n()

    const handleExpand = useCallback((taskId: string) => {
        setExpandedTaskId(taskId)
        onLoadAudio(taskId)
    }, [setExpandedTaskId, onLoadAudio])

    const handleCollapse = useCallback(() => {
        setExpandedTaskId(null)
    }, [setExpandedTaskId])

    const activeTaskId = expandedTaskId || playingTaskId
    const activeTask = useMemo(() => {
        if (!activeTaskId) return null
        return tasks.find(t => t.id === activeTaskId) || null
    }, [tasks, activeTaskId])

    const isLoadingAudio = useMemo(() => checkIsLoadingAudio(activeTask), [activeTask])

    // active task 变化时自动加载音频
    useEffect(() => {
        if (activeTask?.dbId && !activeTask.audioBlob && activeTask.status === 'completed') {
            onLoadAudio(activeTask.id)
        }
    }, [activeTask?.id, activeTask?.dbId, activeTask?.audioBlob, activeTask?.status, onLoadAudio])

    const handlePlayerPlay = useCallback(() => {
        if (activeTask?.audioBlob) onPlay(activeTask)
    }, [activeTask, onPlay])

    const handlePlayerDownload = useCallback(() => {
        if (activeTask) onDownload(activeTask)
    }, [activeTask, onDownload])

    return (
        <div className="flex flex-col h-full">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold">{t('history.title')}</h3>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">{historyTotal}</Badge>
                </div>
                {tasks.some(t => t.status === 'completed') && (
                    <Button variant="ghost" size="sm" className="h-5 gap-0.5 text-[10px] text-muted-foreground hover:text-foreground" onClick={onClearCompleted}>
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>{t('history.clearCompleted')}</span>
                    </Button>
                )}
            </div>

            {/* 音频播放器 */}
            <AudioPlayer
                task={activeTask}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                isLoadingAudio={isLoadingAudio}
                onPlay={handlePlayerPlay}
                onTogglePlay={onTogglePlay}
                onStop={onStop}
                onSeek={onSeek}
                onDownload={handlePlayerDownload}
            />

            {/* 搜索栏 */}
            <div className="px-3 py-1.5 border-b shrink-0">
                <Input
                    placeholder={t('history.search')}
                    value={historySearch}
                    onChange={e => onHistorySearch(e.target.value)}
                    className="h-7 text-xs"
                />
            </div>

            {/* 任务列表 */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-1.5">
                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                <History className="w-6 h-6 opacity-30" />
                            </div>
                            <p className="text-xs font-medium mb-0.5">{t('history.empty')}</p>
                            <p className="text-[11px] text-center mb-3">{t('history.firstHint')}</p>
                            {onNavigateToSynthesis && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[11px] gap-1"
                                    onClick={onNavigateToSynthesis}
                                >
                                    {t('input.title')}
                                    <ArrowRight className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            {tasks.map(task => (
                                <HistoryTaskItem
                                    key={task.id}
                                    task={task}
                                    isExpanded={expandedTaskId === task.id}
                                    isActive={activeTaskId === task.id}
                                    onExpand={handleExpand}
                                    onCollapse={handleCollapse}
                                    onDelete={onDelete}
                                />
                            ))}
                            {historyTotal > historyPageSize && (
                                <Pagination
                                    currentPage={historyPage}
                                    totalPages={Math.ceil(historyTotal / historyPageSize)}
                                    onPageChange={onPageChange}
                                    className="pt-1 pb-2"
                                />
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
