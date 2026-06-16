import {useI18n} from '../i18n/context'
import {SynthesisTask} from '../types'
import {formatTime} from '../lib/audioUtils'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Pagination} from '@/components/ui/pagination'
import {Mic, Download, Trash2, Play, Pause, Square} from 'lucide-react'

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
}

export default function HistoryPanel({
    tasks, historyTotal, historyPage, historyPageSize,
    historySearch, onHistorySearch, onPageChange,
    expandedTaskId, setExpandedTaskId,
    playingTaskId, isPlaying, currentTime, duration,
    onPlay, onTogglePlay, onStop, onSeek, onDelete, onClearCompleted, onDownload
}: HistoryPanelProps) {
    const {t} = useI18n()

    return (
        <Card className="flex flex-col border-0 shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold">{t('history.title')}</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {historyTotal}
                    </Badge>
                </div>
                {tasks.some(t => t.status === 'completed') && (
                    <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={onClearCompleted}>
                        <Trash2 className="w-3 h-3" />
                        <span>{t('history.clearCompleted')}</span>
                    </Button>
                )}
            </div>
            <div className="px-3 py-1.5 border-b">
                <Input
                    placeholder={t('history.search')}
                    value={historySearch}
                    onChange={e => onHistorySearch(e.target.value)}
                    className="h-7 text-xs"
                />
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Mic className="w-6 h-6 opacity-50" />
                            </div>
                            <p className="text-xs font-medium">{t('history.empty')}</p>
                            <p className="text-[10px] mt-0.5">{t('history.firstHint')}</p>
                        </div>
                    ) : (
                        <>
                            {tasks.map(task => (
                                <Card 
                                    key={task.id} 
                                    className={`transition-all duration-150 hover:shadow-sm ${
                                        task.status === 'error' ? 'border-destructive' : 
                                        playingTaskId === task.id ? 'border-primary' : ''
                                    }`}
                                >
                                    <CardContent className="p-2.5">
                                        <div 
                                            className="flex items-start justify-between gap-2 cursor-pointer" 
                                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                                                    {expandedTaskId === task.id ? task.text : (task.text.slice(0, 80) + (task.text.length > 80 ? '...' : ''))}
                                                </p>
                                                <div className="flex gap-1.5 mt-1.5">
                                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                                        {task.voice}
                                                    </Badge>
                                                    {task.style && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                            {task.style.slice(0, 10)}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {task.status === 'synthesizing' && (
                                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                )}
                                                {task.status === 'error' && (
                                                    <span className="text-[10px] text-destructive max-w-[80px] truncate">
                                                        {task.error}
                                                    </span>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={e => { e.stopPropagation(); onDelete(task.id) }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        {expandedTaskId === task.id && task.status === 'completed' && task.audioBlob && (
                                            <div className="mt-2 pt-2 border-t" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5">
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-7 w-7"
                                                        onClick={() => playingTaskId === task.id ? onTogglePlay() : onPlay(task)}
                                                    >
                                                        {playingTaskId === task.id && isPlaying ? (
                                                            <Pause className="w-3 h-3" />
                                                        ) : (
                                                            <Play className="w-3 h-3" />
                                                        )}
                                                    </Button>
                                                    {playingTaskId === task.id && (
                                                        <>
                                                            <Button 
                                                                variant="outline" 
                                                                size="icon" 
                                                                className="h-7 w-7"
                                                                onClick={onStop}
                                                            >
                                                                <Square className="w-3 h-3" />
                                                            </Button>
                                                            <div className="flex-1 flex items-center gap-1.5">
                                                                <span className="text-[10px] text-muted-foreground tabular-nums w-10">
                                                                    {formatTime(currentTime)}
                                                                </span>
                                                                <input 
                                                                    type="range" 
                                                                    className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer"
                                                                    min={0} 
                                                                    max={duration || 0} 
                                                                    step={0.1} 
                                                                    value={currentTime} 
                                                                    onChange={onSeek} 
                                                                />
                                                                <span className="text-[10px] text-muted-foreground tabular-nums w-10">
                                                                    {formatTime(duration)}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                    <Button 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-7 w-7"
                                                        onClick={() => onDownload(task)}
                                                    >
                                                        <Download className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
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
        </Card>
    )
}
