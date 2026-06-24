import {useState, useRef, useCallback} from 'react'
import {SynthesizeSpeech, SynthesizeSpeechStream, SaveToHistory} from '../lib/backend'
import {ModelType, SynthesisTask} from '../types'
import {createTaskId, addWavHeader} from '../lib/audioUtils'
import {useI18n} from '../i18n/context'
import {toast} from 'sonner'

export function useSynthesis(
    addTask: (task: SynthesisTask) => void,
    updateTask: (taskId: string, updates: Partial<SynthesisTask>) => void,
    incrementTotal: () => void,
    playAudio: (task: SynthesisTask) => void,
) {
    const {t} = useI18n()
    const [isSynthesizing, setIsSynthesizing] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const [isStreamPaused, setIsStreamPaused] = useState(false)
    const streamAbortRef = useRef<AbortController | null>(null)
    const synthesizeAbortRef = useRef<AbortController | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const currentTaskIdRef = useRef<string | null>(null)

    const synthesize = useCallback(async (
        text: string,
        model: ModelType,
        voice: string,
        style: string,
        optimizeTextPreview?: boolean,
    ) => {
        if (!text.trim()) { toast.error(t('synthesis.enterText')); return }
        const taskId = createTaskId()
        const newTask: SynthesisTask = {
            id: taskId, text, model, voice,
            style: style || undefined, status: 'synthesizing',
            progress: 0, createdAt: new Date().toISOString(),
        }
        addTask(newTask)
        setIsSynthesizing(true)
        currentTaskIdRef.current = taskId
        const abortController = new AbortController()
        synthesizeAbortRef.current = abortController
        try {
            const result = await SynthesizeSpeech(text, model, voice, style, optimizeTextPreview, abortController.signal)
            if (abortController.signal.aborted) {
                updateTask(taskId, {status: 'error', error: t('synthesis.cancelled')})
                return
            }
            if (result.error) {
                updateTask(taskId, {status: 'error', error: result.error})
                toast.error(result.error)
                return
            }
            const binaryString = atob(result.audioData)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
            const blob = new Blob([bytes], {type: 'audio/wav'})
            updateTask(taskId, {status: 'completed', progress: 100, audioBlob: blob, hasAudio: true})
            incrementTotal()
            toast.success(t('synthesis.completed'))
            SaveToHistory(text, model, voice, style || '', result.audioData, 'wav').catch(console.error)
            playAudio({...newTask, status: 'completed', progress: 100, audioBlob: blob})
        } catch (err: any) {
            if (!abortController.signal.aborted) {
                updateTask(taskId, {status: 'error', error: err.message})
                toast.error(err.message)
            }
        } finally {
            setIsSynthesizing(false)
            currentTaskIdRef.current = null
            synthesizeAbortRef.current = null
        }
    }, [t, addTask, updateTask, incrementTotal, playAudio])

    const synthesizeStream = useCallback(async (
        text: string,
        model: ModelType,
        voice: string,
        style: string,
        optimizeTextPreview?: boolean,
    ) => {
        if (!text.trim()) { toast.error(t('synthesis.enterText')); return }
        const taskId = createTaskId()
        const newTask: SynthesisTask = {
            id: taskId, text, model, voice,
            style: style || undefined, status: 'synthesizing',
            progress: 0, createdAt: new Date().toISOString(),
        }
        addTask(newTask)
        setIsStreaming(true)
        setIsStreamPaused(false)
        currentTaskIdRef.current = taskId
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        let lastProgressUpdate = 0
        try {
            const audioContext = new AudioContext({sampleRate: 24000})
            await audioContext.resume()
            audioContextRef.current = audioContext
            const pcmChunks: Uint8Array[] = []
            let totalLength = 0
            let nextStartTime = audioContext.currentTime + 0.1

            for await (const chunk of SynthesizeSpeechStream(text, model, voice, style, optimizeTextPreview, abortController.signal)) {
                if (abortController.signal.aborted) break
                while (isStreamPaused && !abortController.signal.aborted) await new Promise(resolve => setTimeout(resolve, 100))
                if (abortController.signal.aborted) break
                pcmChunks.push(chunk)
                totalLength += chunk.length
                const float32Chunk = new Float32Array(chunk.length / 2)
                for (let i = 0; i < chunk.length; i += 2) {
                    const sample = chunk[i] | (chunk[i + 1] << 8)
                    float32Chunk[i / 2] = (sample < 32768 ? sample : sample - 65536) / 32768.0
                }
                const buffer = audioContext.createBuffer(1, float32Chunk.length, 24000)
                buffer.getChannelData(0).set(float32Chunk)
                const source = audioContext.createBufferSource()
                source.buffer = buffer
                source.connect(audioContext.destination)
                source.start(nextStartTime)
                nextStartTime += buffer.duration
                const now = Date.now()
                if (now - lastProgressUpdate > 300) {
                    updateTask(taskId, {progress: Math.min(90, totalLength / 1000)})
                    lastProgressUpdate = now
                }
            }

            if (abortController.signal.aborted) {
                await audioContext.close()
                audioContextRef.current = null
                updateTask(taskId, {status: 'error', error: t('synthesis.cancelled')})
                return
            }

            const fullPcm = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of pcmChunks) { fullPcm.set(chunk, offset); offset += chunk.length }
            const wavData = addWavHeader(fullPcm)
            const blob = new Blob([wavData.buffer as ArrayBuffer], {type: 'audio/wav'})
            const remainingTime = (nextStartTime - audioContext.currentTime) * 1000
            if (remainingTime > 0) await new Promise(resolve => setTimeout(resolve, remainingTime + 200))
            await audioContext.close()
            audioContextRef.current = null
            updateTask(taskId, {status: 'completed', progress: 100, audioBlob: blob, hasAudio: true})
            incrementTotal()
            toast.success(t('synthesis.completed'))
            SaveToHistory(text, model, voice, style || '', wavData, 'wav').catch(console.error)
        } catch (err: any) {
            if (!abortController.signal.aborted) {
                updateTask(taskId, {status: 'error', error: err.message})
                toast.error(err.message)
            }
        } finally {
            setIsStreaming(false)
            setIsStreamPaused(false)
            audioContextRef.current = null
            currentTaskIdRef.current = null
            streamAbortRef.current = null
        }
    }, [t, addTask, updateTask, incrementTotal, isStreamPaused])

    const toggleStreamPause = useCallback(() => {
        if (audioContextRef.current) {
            isStreamPaused ? audioContextRef.current.resume() : audioContextRef.current.suspend()
            setIsStreamPaused(!isStreamPaused)
        }
    }, [isStreamPaused])

    const cancelSynthesize = useCallback(() => {
        synthesizeAbortRef.current?.abort()
        if (currentTaskIdRef.current) {
            updateTask(currentTaskIdRef.current, {status: 'error', error: t('synthesis.cancelled')})
        }
        setIsSynthesizing(false)
        currentTaskIdRef.current = null
        synthesizeAbortRef.current = null
    }, [updateTask, t])

    const cancelStream = useCallback(() => {
        streamAbortRef.current?.abort()
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        if (currentTaskIdRef.current) {
            updateTask(currentTaskIdRef.current, {status: 'error', error: t('synthesis.cancelled')})
        }
        setIsStreaming(false)
        setIsStreamPaused(false)
        currentTaskIdRef.current = null
        streamAbortRef.current = null
    }, [updateTask, t])

    return {
        isSynthesizing,
        isStreaming,
        isStreamPaused,
        synthesize,
        synthesizeStream,
        toggleStreamPause,
        cancelSynthesize,
        cancelStream,
    }
}
