import {useMemo, useCallback, memo} from 'react'
import {useI18n} from '../i18n/context'
import {SynthesisTask} from '../types'
import {formatTime, isLoadingAudio as checkIsLoadingAudio} from '../lib/audioUtils'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Play, Pause, Square, Download, Loader2, Volume2, CheckCircle2, AlertCircle} from 'lucide-react'

interface SynthesisPreviewProps {
    tasks: SynthesisTask[]
    isSynthesizing: boolean
    isStreaming: boolean
    playingTaskId: string | null
    isPlaying: boolean
    currentTime: number
    duration: number
    onPlay: (task: SynthesisTask) => void
    onTogglePlay: () => void
    onStop: () => void
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    onDownload: (task: SynthesisTask) => void
    onLoadAudio: (taskId: string) => void
}

function SynthesisPreview({
    tasks, isSynthesizing, isStreaming,
    playingTaskId, isPlaying, currentTime, duration,
    onPlay, onTogglePlay, onStop, onSeek, onDownload, onLoadAudio
}: SynthesisPreviewProps) {
    const {t} = useI18n()

    const latestTask = useMemo(() => {
        if (!tasks.length) return null
        const synthesizing = tasks.find(t => t.status === 'synthesizing')
        if (synthesizing) return synthesizing
        const completed = tasks.find(t => t.status === 'completed')
        return completed || tasks[0]
    }, [tasks])

    const isLoadingAudio = useMemo(() => checkIsLoadingAudio(latestTask), [latestTask])

    const handlePlay = useCallback(() => {
        if (latestTask?.audioBlob) onPlay(latestTask)
    }, [latestTask, onPlay])

    const handleDownload = useCallback(() => {
        if (latestTask) onDownload(latestTask)
    }, [latestTask, onDownload])

    // 无任务时显示空状态
    if (!latestTask) {
        return (
            <div className="h-full flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
                <Volume2 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">{t('audio.notAvailable')}</p>
            </div>
        )
    }

    const isActive = playingTaskId === latestTask.id
    const isTaskPlaying = isActive && isPlaying

    return (
        <div className="h-full flex flex-col rounded-lg border bg-card shadow-sm overflow-hidden">
            {/* 状态栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-2">
                    {latestTask.status === 'synthesizing' ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            <span className="text-xs font-medium text-primary">
                                {isStreaming ? t('synthesis.streaming') : t('synthesis.synthesizing')}
                            </span>
                            {latestTask.progress !== undefined && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-300"
                                            style={{width: `${latestTask.progress}%`}}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(latestTask.progress)}%</span>
                                </div>
                            )}
                        </>
                    ) : latestTask.status === 'completed' ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">{t('synthesis.completed')}</span>
                        </>
                    ) : latestTask.status === 'error' ? (
                        <>
                            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            <span className="text-xs font-medium text-destructive">{t('synthesis.error')}</span>
                        </>
                    ) : null}
                </div>
                <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{latestTask.voice}</Badge>
                    {latestTask.model && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {latestTask.model.replace('mimo-v2.5-tts-', '')}
                        </Badge>
                    )}
                </div>
            </div>

            {/* 内容区 - 自动填满 */}
            {latestTask.status === 'completed' && (
                <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
                    {/* 文本预览 */}
                    <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-3 shrink-0">
                        {latestTask.text}
                    </p>

                    {/* 播放控制 - 居中显示 */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0">
                        {isLoadingAudio ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t('audio.loading')}</span>
                            </div>
                        ) : latestTask.audioBlob ? (
                            <>
                                {/* 主播放按钮行 */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant={isTaskPlaying ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-10 w-10 rounded-full shrink-0"
                                        onClick={isTaskPlaying ? onTogglePlay : handlePlay}
                                    >
                                        {isTaskPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                    </Button>
                                    {isActive && (
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={onStop}>
                                            <Square className="w-3 h-3" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={handleDownload}>
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* 进度条行 */}
                                {isActive && (
                                    <div className="w-full max-w-xs flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{formatTime(currentTime)}</span>
                                        <input
                                            type="range"
                                            className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                            min={0}
                                            max={duration || 0}
                                            step={0.1}
                                            value={currentTime}
                                            onChange={onSeek}
                                        />
                                        <span className="text-[10px] text-muted-foreground tabular-nums w-8">{formatTime(duration)}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Volume2 className="w-4 h-4 opacity-40" />
                                <span>{t('audio.notAvailable')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 错误信息 */}
            {latestTask.status === 'error' && latestTask.error && (
                <div className="flex-1 flex items-center justify-center p-3">
                    <p className="text-xs text-destructive text-center">{latestTask.error}</p>
                </div>
            )}

            {/* 合成中状态 */}
            {latestTask.status === 'synthesizing' && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <span className="text-xs text-muted-foreground">{t('synthesis.synthesizing')}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

export default memo(SynthesisPreview)
