import {useState, useRef, useCallback} from 'react'
import {SynthesisTask} from '../types'

export function useAudioPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const audioUrlRef = useRef<string | null>(null)
    const animFrameRef = useRef<number | null>(null)
    const [playingTaskId, setPlayingTaskId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.onended = null
            audioRef.current.ontimeupdate = null
            audioRef.current = null
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current)
            audioUrlRef.current = null
        }
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current)
            animFrameRef.current = null
        }
        setPlayingTaskId(null)
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)
    }, [])

    const play = useCallback((task: SynthesisTask) => {
        if (!task.audioBlob) return

        stop()

        const url = URL.createObjectURL(task.audioBlob)
        audioUrlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        audio.volume = volume

        const updateProgress = () => {
            if (audioRef.current && !audioRef.current.paused) {
                setCurrentTime(audioRef.current.currentTime)
                animFrameRef.current = requestAnimationFrame(updateProgress)
            }
        }

        audio.onloadedmetadata = () => setDuration(audio.duration)
        audio.onended = () => stop()
        audio.onplay = () => { setIsPlaying(true); updateProgress() }
        audio.onpause = () => {
            setIsPlaying(false)
            if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
        }

        audio.play()
        setPlayingTaskId(task.id)
    }, [volume, stop])

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return
        isPlaying ? audioRef.current.pause() : audioRef.current.play()
    }, [isPlaying])

    const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return
        const time = parseFloat(e.target.value)
        audioRef.current.currentTime = time
        setCurrentTime(time)
    }, [])

    return {
        playingTaskId,
        isPlaying,
        currentTime,
        duration,
        volume,
        setVolume,
        play,
        togglePlay,
        stop,
        seek,
    }
}
