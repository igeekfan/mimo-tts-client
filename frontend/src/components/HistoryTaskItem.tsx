import {memo, useCallback, useMemo} from 'react'
import {SynthesisTask} from '../types'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Trash2, ChevronRight, Loader2, CheckCircle2, AlertCircle} from 'lucide-react'

interface HistoryTaskItemProps {
    task: SynthesisTask
    isExpanded: boolean
    isActive: boolean
    onExpand: (taskId: string) => void
    onCollapse: () => void
    onDelete: (taskId: string) => void
}

const HistoryTaskItem = memo(function HistoryTaskItem({
    task, isExpanded, isActive,
    onExpand, onCollapse, onDelete,
}: HistoryTaskItemProps) {
    const handleClick = useCallback(() => {
        if (isExpanded) {
            onCollapse()
        } else {
            onExpand(task.id)
        }
    }, [isExpanded, task.id, onExpand, onCollapse])

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onDelete(task.id)
    }, [task.id, onDelete])

    const timeStr = useMemo(() => {
        return new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    }, [task.createdAt])

    const StatusIcon = useMemo(() => {
        switch (task.status) {
            case 'synthesizing': return <Loader2 className="w-3 h-3 text-primary animate-spin" />
            case 'completed': return <CheckCircle2 className="w-3 h-3 text-green-500" />
            case 'error': return <AlertCircle className="w-3 h-3 text-destructive" />
            default: return null
        }
    }, [task.status])

    return (
        <div className={`rounded-md border bg-card text-card-foreground transition-colors ${
            task.status === 'error' ? 'border-destructive/50' :
            isActive ? 'border-primary/40 bg-primary/5' : ''
        }`}>
            <div className="px-2.5 py-2">
                {/* 主行 */}
                <div className="flex items-start gap-2 cursor-pointer" onClick={handleClick}>
                    <ChevronRight className={`shrink-0 w-3 h-3 text-muted-foreground/40 transition-transform duration-150 mt-0.5 ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${isExpanded ? 'text-muted-foreground' : ''}`}>
                            {isExpanded
                                ? task.text.slice(0, 40) + (task.text.length > 40 ? '…' : '')
                                : task.text.length > 55 ? task.text.slice(0, 55) + '…' : task.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                            {StatusIcon}
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-4">
                                {task.voice}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground/50 tabular-nums">{timeStr}</span>
                            {task.status === 'error' && task.error && (
                                <span className="text-[9px] text-destructive truncate max-w-[80px]">{task.error}</span>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-5 w-5 text-muted-foreground/30 hover:text-destructive"
                        onClick={handleDelete}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                    <div className="mt-2 pt-2 ml-5 border-t space-y-2" onClick={e => e.stopPropagation()}>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-foreground/80">
                            {task.text}
                        </p>
                        <div className="flex gap-1 flex-wrap">
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                {task.voice}
                            </Badge>
                            {task.model && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {task.model.replace('mimo-v2.5-tts', 'TTS')}
                                </Badge>
                            )}
                            {task.style && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 max-w-[100px] truncate">
                                    {task.style}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
})

export default HistoryTaskItem
