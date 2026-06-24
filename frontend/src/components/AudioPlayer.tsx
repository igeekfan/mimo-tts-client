import {memo} from 'react'
import {SynthesisTask} from '../types'
import {formatTime} from '../lib/audioUtils'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Play, Pause, Square, Download, Loader2, Volume2} from 'lucide-react'

interface AudioPlayerProps {
    task: SynthesisTask | null
    isPlaying: boolean
    currentTime: number
    duration: number
    isLoadingAudio: boolean
    onPlay: () => void
    onTogglePlay: () => void
    onStop: () => void
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
    onDownload: () => void
}

const AudioPlayer = memo(function AudioPlayer({
    task, isPlaying, currentTime, duration, isLoadingAudio,
    onPlay, onTogglePlay, onStop, onSeek, onDownload,
}: AudioPlayerProps) {
    if (!task) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/10 text-muted-foreground">
                <Volume2 className="w-3 h-3 shrink-0 opacity-30" />
                <span className="text-[10px]">Select a task to play audio</span>
            </div>
        )
    }

    const hasAudio = !!task.audioBlob
    const canPlay = hasAudio && task.status === 'completed'

    return (
        <div className="px-3 py-2 border-b bg-muted/10 space-y-1.5 shrink-0">
            {/* 任务信息 */}
            <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-[10px] text-foreground/70 leading-relaxed truncate">
                    {task.text.length > 60 ? task.text.slice(0, 60) + '…' : task.text}
                </p>
                <div className="flex gap-1 shrink-0">
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">{task.voice}</Badge>
                    {task.model && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{task.model.replace('mimo-v2.5-tts', 'TTS')}</Badge>
                    )}
                </div>
            </div>

            {/* 播放控制 */}
            <div className="flex items-center gap-1.5">
                {isLoadingAudio ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading...</span>
                    </div>
                ) : canPlay ? (
                    <>
                        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" onClick={isPlaying ? onTogglePlay : onPlay}>
                            {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                        </Button>
                        <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" onClick={onStop}>
                            <Square className="w-2.5 h-2.5" />
                        </Button>
                        <span className="text-[9px] text-muted-foreground tabular-nums w-7 text-right">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={onSeek}
                        />
                        <span className="text-[9px] text-muted-foreground tabular-nums w-7">{formatTime(duration)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground" onClick={onDownload}>
                            <Download className="w-3 h-3" />
                        </Button>
                    </>
                ) : (
                    <span className="text-[10px] text-muted-foreground">No audio</span>
                )}
            </div>
        </div>
    )
})

export default AudioPlayer
