import {useState, useEffect, useCallback, useRef} from 'react'
import {SynthesizeSpeech, SynthesizeSpeechStream, GetSettings, SaveSettings, SearchHistory, SaveToHistory, GetHistoryAudio, DeleteHistory, ClearHistory, CheckForUpdate, GetAboutInfo, OpenReleasePage} from './lib/backend'
import {EventsOn} from './lib/runtime'
import {useI18n} from './i18n/context'
import {ModelType, SynthesisTask, AboutInfo, UpdateInfo} from './types'
import {createTaskId, addWavHeader} from './lib/audioUtils'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import SettingsDialog from './components/SettingsDialog'
import SynthesisSettings from './components/SynthesisSettings'
import TextInput from './components/TextInput'
import HistoryPanel from './components/HistoryPanel'
import LogPanel from './components/LogPanel'
import {toast} from 'sonner'
import {Mic, Sun, Moon} from 'lucide-react'
import './App.css'

function App() {
    const {t, lang, setLang} = useI18n()
    const [inputText, setInputText] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [styleOpen, setStyleOpen] = useState(false)
    const [tagsOpen, setTagsOpen] = useState(false)
    const [model, setModel] = useState<ModelType>('mimo-v2.5-tts')
    const [voice, setVoice] = useState('mimo_default')
    const [style, setStyle] = useState('')
    const [tasks, setTasks] = useState<SynthesisTask[]>([])
    const [theme, setTheme] = useState<'light' | 'dark'>('dark')
    const [apiKey, setApiKey] = useState('')
    const [baseUrl, setBaseUrl] = useState('https://api.xiaomimimo.com/v1')
    const [directorMode, setDirectorMode] = useState(false)
    const [directorRole, setDirectorRole] = useState('')
    const [directorScene, setDirectorScene] = useState('')
    const [directorDirection, setDirectorDirection] = useState('')
    const [optimizeTextPreview, setOptimizeTextPreview] = useState(true)
    const [cloneFileName, setCloneFileName] = useState('')
    const [styleHistory, setStyleHistory] = useState<string[]>([])
    const [historySearch, setHistorySearch] = useState('')
    const [historyTotal, setHistoryTotal] = useState(0)
    const [historyPage, setHistoryPage] = useState(1)
    const historyPageSize = 20
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [isStreamPaused, setIsStreamPaused] = useState(false)
    const streamAbortRef = useRef<AbortController | null>(null)
    const [apiSettingsOpen, setApiSettingsOpen] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const [logPanelOpen, setLogPanelOpen] = useState(false)
    const [logPanelHeight, setLogPanelHeight] = useState(240)
    const logDragRef = useRef<{startY: number; startH: number} | null>(null)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [updateLoading, setUpdateLoading] = useState(false)
    const [updateError, setUpdateError] = useState('')

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const audioUrlRef = useRef<string | null>(null)
    const animFrameRef = useRef<number | null>(null)
    const [playingTaskId, setPlayingTaskId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(1)

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle('dark', theme === 'dark')
        root.classList.toggle('light', theme === 'light')
    }, [theme])

    useEffect(() => {
        const off = EventsOn('app:log', (msg: string) => {
            setLogs(prev => [...prev.slice(-200), msg])
        })
        return off
    }, [])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({behavior: 'smooth'})
    }, [logs])

    useEffect(() => {
        GetSettings().then(settings => {
            if (settings.theme) setTheme(settings.theme as 'light' | 'dark')
            if (settings.apiKey) setApiKey(settings.apiKey)
            if (settings.baseUrl) setBaseUrl(settings.baseUrl)
            if (settings.model) setModel(settings.model as ModelType)
            if (settings.voice) setVoice(settings.voice)
            if (settings.style !== undefined) setStyle(settings.style)
            if (settings.styleHistory) setStyleHistory(settings.styleHistory)
        }).catch(console.error)

        GetAboutInfo().then(info => setAboutInfo(info)).catch(console.error)

        loadHistory('', 1)
    }, [])

    const loadHistory = useCallback(async (query: string, page: number) => {
        try {
            const offset = (page - 1) * historyPageSize
            const result = await SearchHistory(query, offset, historyPageSize)
            const loadedTasks: SynthesisTask[] = []
            for (const item of result.items) {
                let audioBlob: Blob | undefined
                if (item.hasAudio) {
                    try {
                        audioBlob = await GetHistoryAudio(item.id)
                    } catch (e) {
                        console.error('Failed to load audio:', e)
                    }
                }
                loadedTasks.push({
                    id: `db-${item.id}`,
                    text: item.text,
                    model: item.model as ModelType,
                    voice: item.voice,
                    style: item.style || undefined,
                    status: 'completed',
                    progress: 100,
                    audioBlob,
                    createdAt: item.createdAt,
                    dbId: item.id,
                })
            }
            setTasks(loadedTasks)
            setHistoryTotal(result.total)
            setHistoryPage(page)
        } catch (e) {
            console.error('Failed to load history:', e)
        }
    }, [historyPageSize])

    const handleSaveSettings = useCallback(async () => {
        try {
            await SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style, styleHistory})
            toast.success(t('settings.saved'))
        } catch (err: any) {
            toast.error(err.message)
        }
    }, [theme, lang, apiKey, baseUrl, model, voice, style, styleHistory, t])

    useEffect(() => {
        const timer = setTimeout(() => {
            SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style, styleHistory}).catch(console.error)
        }, 500)
        return () => clearTimeout(timer)
    }, [lang, theme, apiKey, baseUrl, model, voice, style, styleHistory])

    const handleCheckUpdate = useCallback(async () => {
        setUpdateLoading(true)
        setUpdateError('')
        try {
            const info = await CheckForUpdate()
            setUpdateInfo(info)
        } catch (err: any) {
            setUpdateError(err.message)
        } finally {
            setUpdateLoading(false)
        }
    }, [])

    const handleOpenReleasePage = useCallback(async () => {
        try {
            await OpenReleasePage()
        } catch (err: any) {
            toast.error(err.message)
        }
    }, [])

    const stopCurrentAudio = useCallback(() => {
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

    const playAudio = useCallback((task: SynthesisTask) => {
        if (!task.audioBlob) return

        stopCurrentAudio()

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
        audio.onended = () => stopCurrentAudio()
        audio.onplay = () => { setIsPlaying(true); updateProgress() }
        audio.onpause = () => {
            setIsPlaying(false)
            if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
        }

        audio.play()
        setPlayingTaskId(task.id)
    }, [volume, stopCurrentAudio])

    const handleTogglePlay = useCallback(() => {
        if (!audioRef.current) return
        isPlaying ? audioRef.current.pause() : audioRef.current.play()
    }, [isPlaying])

    const handleStop = useCallback(() => stopCurrentAudio(), [stopCurrentAudio])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return
        const time = parseFloat(e.target.value)
        audioRef.current.currentTime = time
        setCurrentTime(time)
    }, [])

    const buildStyleContent = useCallback(() => {
        if (directorMode) {
            const parts = []
            if (directorRole) parts.push(`角色：${directorRole}`)
            if (directorScene) parts.push(`场景：${directorScene}`)
            if (directorDirection) parts.push(`指导：${directorDirection}`)
            return parts.join('\n\n')
        }
        return style
    }, [directorMode, directorRole, directorScene, directorDirection, style])

    const saveStyleToHistory = useCallback((newStyle: string) => {
        if (!newStyle.trim()) return
        setStyleHistory(prev => {
            const filtered = prev.filter(s => s !== newStyle)
            return [newStyle, ...filtered].slice(0, 20)
        })
    }, [])

    const deleteStyleFromHistory = useCallback((styleToDelete: string) => {
        setStyleHistory(prev => prev.filter(s => s !== styleToDelete))
    }, [])

    const handleHistorySearch = useCallback((query: string) => {
        setHistorySearch(query)
        loadHistory(query, 1)
    }, [loadHistory])

    const handlePageChange = useCallback((page: number) => {
        loadHistory(historySearch, page)
    }, [loadHistory, historySearch])

    const handleSynthesize = useCallback(async () => {
        if (!inputText.trim()) { toast.error(t('synthesis.enterText')); return }
        const taskId = createTaskId()
        const currentStyle = buildStyleContent()
        const newTask: SynthesisTask = {
            id: taskId, text: inputText, model, voice,
            style: currentStyle || undefined, status: 'synthesizing',
            progress: 0, createdAt: new Date().toISOString(),
        }
        setTasks(prev => [newTask, ...prev])
        try {
            const result = await SynthesizeSpeech(inputText, model, voice, currentStyle, model === 'mimo-v2.5-tts-voicedesign' ? optimizeTextPreview : undefined)
            if (result.error) {
                setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: result.error} : t))
                toast.error(result.error)
                return
            }
            const binaryString = atob(result.audioData)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
            const blob = new Blob([bytes], {type: 'audio/wav'})
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'completed', progress: 100, audioBlob: blob} : t))
            setHistoryTotal(prev => prev + 1)
            toast.success(t('synthesis.completed'))
            SaveToHistory(inputText, model, voice, currentStyle || '', result.audioData, 'wav').catch(console.error)
            playAudio({...newTask, status: 'completed', progress: 100, audioBlob: blob})
        } catch (err: any) {
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: err.message} : t))
            toast.error(err.message)
        }
    }, [inputText, model, voice, style, t, playAudio])

    const handleSynthesizeStream = useCallback(async () => {
        if (!inputText.trim()) { toast.error(t('synthesis.enterText')); return }
        const taskId = createTaskId()
        const currentStyle = buildStyleContent()
        const newTask: SynthesisTask = {
            id: taskId, text: inputText, model, voice,
            style: currentStyle || undefined, status: 'synthesizing',
            progress: 0, createdAt: new Date().toISOString(),
        }
        setTasks(prev => [newTask, ...prev])
        setIsStreaming(true); setIsStreamPaused(false); setPlayingTaskId(taskId); setIsPlaying(true)
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        try {
            const audioContext = new AudioContext({sampleRate: 24000})
            await audioContext.resume()
            audioContextRef.current = audioContext
            const pcmChunks: Uint8Array[] = []
            let totalLength = 0
            let nextStartTime = audioContext.currentTime + 0.1

            for await (const chunk of SynthesizeSpeechStream(inputText, model, voice, currentStyle, model === 'mimo-v2.5-tts-voicedesign' ? optimizeTextPreview : undefined)) {
                if (abortController.signal.aborted) break
                while (isStreamPaused && !abortController.signal.aborted) await new Promise(resolve => setTimeout(resolve, 100))
                if (abortController.signal.aborted) break
                pcmChunks.push(chunk); totalLength += chunk.length
                const float32Chunk = new Float32Array(chunk.length / 2)
                for (let i = 0; i < chunk.length; i += 2) {
                    const sample = chunk[i] | (chunk[i + 1] << 8)
                    float32Chunk[i / 2] = (sample < 32768 ? sample : sample - 65536) / 32768.0
                }
                const buffer = audioContext.createBuffer(1, float32Chunk.length, 24000)
                buffer.getChannelData(0).set(float32Chunk)
                const source = audioContext.createBufferSource()
                source.buffer = buffer; source.connect(audioContext.destination); source.start(nextStartTime)
                nextStartTime += buffer.duration
                setTasks(prev => prev.map(t => t.id === taskId ? {...t, progress: Math.min(90, (totalLength / 1000))} : t))
            }

            if (abortController.signal.aborted) {
                await audioContext.close(); audioContextRef.current = null
                setTasks(prev => prev.map(task => task.id === taskId ? {...task, status: 'error', error: t('synthesis.cancelled')} : task))
                return
            }

            const fullPcm = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of pcmChunks) { fullPcm.set(chunk, offset); offset += chunk.length }
            const wavData = addWavHeader(fullPcm)
            const blob = new Blob([wavData.buffer as ArrayBuffer], {type: 'audio/wav'})
            const remainingTime = (nextStartTime - audioContext.currentTime) * 1000
            if (remainingTime > 0) await new Promise(resolve => setTimeout(resolve, remainingTime + 200))
            await audioContext.close(); audioContextRef.current = null
            const completedTask = {...newTask, status: 'completed' as const, progress: 100, audioBlob: blob}
            setTasks(prev => prev.map(t => t.id === taskId ? completedTask : t))
            setHistoryTotal(prev => prev + 1)
            toast.success(t('synthesis.completed'))
            SaveToHistory(inputText, model, voice, currentStyle || '', wavData, 'wav').catch(console.error)
        } catch (err: any) {
            if (!abortController.signal.aborted) {
                setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: err.message} : t))
                toast.error(err.message)
            }
        } finally {
            setIsStreaming(false); setIsStreamPaused(false); setPlayingTaskId(null); setIsPlaying(false)
            audioContextRef.current = null; streamAbortRef.current = null
        }
    }, [inputText, model, voice, style, t])

    const handleToggleStreamPause = useCallback(() => {
        if (audioContextRef.current) {
            isStreamPaused ? audioContextRef.current.resume() : audioContextRef.current.suspend()
            setIsStreamPaused(!isStreamPaused)
        }
    }, [isStreamPaused])

    const handleCancelStream = useCallback(() => {
        streamAbortRef.current?.abort()
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null }
        setIsStreaming(false); setIsStreamPaused(false); setPlayingTaskId(null); setIsPlaying(false)
    }, [])

    const handleDownload = useCallback((task: SynthesisTask) => {
        if (!task.audioBlob) return
        const url = URL.createObjectURL(task.audioBlob)
        const a = document.createElement('a')
        a.href = url; a.download = `tts_${task.voice}_${Date.now()}.wav`; a.click()
        URL.revokeObjectURL(url)
    }, [])

    const handleDeleteTask = useCallback((taskId: string) => {
        if (playingTaskId === taskId) stopCurrentAudio()
        const task = tasks.find(t => t.id === taskId)
        if (task?.dbId) DeleteHistory(task.dbId).catch(console.error)
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setHistoryTotal(prev => Math.max(0, prev - 1))
    }, [playingTaskId, tasks, stopCurrentAudio])

    const handleClearCompleted = useCallback(() => {
        if (playingTaskId && tasks.find(t => t.id === playingTaskId)?.status === 'completed') stopCurrentAudio()
        ClearHistory().catch(console.error)
        setTasks(prev => prev.filter(t => t.status !== 'completed'))
        setHistoryTotal(0); setHistoryPage(1)
    }, [playingTaskId, tasks, stopCurrentAudio])

    const handleLogDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        logDragRef.current = {startY: e.clientY, startH: logPanelHeight}
        const handleMove = (ev: MouseEvent) => {
            if (!logDragRef.current) return
            const delta = logDragRef.current.startY - ev.clientY
            setLogPanelHeight(Math.max(120, Math.min(600, logDragRef.current.startH + delta)))
        }
        const handleUp = () => {
            logDragRef.current = null
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
        }
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
    }, [logPanelHeight])

    useEffect(() => () => stopCurrentAudio(), [])

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <header className="flex justify-between items-center px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                        <Mic className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                    <h1 className="text-sm font-semibold tracking-tight">MiMo TTS</h1>
                </div>
                <div className="flex items-center gap-1.5">
                    <SettingsDialog
                        open={apiSettingsOpen}
                        onOpenChange={setApiSettingsOpen}
                        theme={theme}
                        setTheme={setTheme}
                        lang={lang}
                        setLang={setLang}
                        apiKey={apiKey}
                        setApiKey={setApiKey}
                        baseUrl={baseUrl}
                        setBaseUrl={setBaseUrl}
                        aboutInfo={aboutInfo}
                        updateInfo={updateInfo}
                        updateLoading={updateLoading}
                        updateError={updateError}
                        handleCheckUpdate={handleCheckUpdate}
                        handleOpenReleasePage={handleOpenReleasePage}
                    />
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')}>
                        {lang === 'zh-CN' ? 'EN' : '中'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-4 xl:px-8 overflow-hidden">
                <div className="grid grid-cols-2 gap-4 h-full max-w-6xl mx-auto">
                    <ScrollArea className="h-full">
                        <div className="space-y-3 pr-3">
                            <SynthesisSettings
                                model={model}
                                setModel={setModel}
                                voice={voice}
                                setVoice={setVoice}
                                style={style}
                                setStyle={setStyle}
                                directorMode={directorMode}
                                setDirectorMode={setDirectorMode}
                                directorRole={directorRole}
                                setDirectorRole={setDirectorRole}
                                directorScene={directorScene}
                                setDirectorScene={setDirectorScene}
                                directorDirection={directorDirection}
                                setDirectorDirection={setDirectorDirection}
                                optimizeTextPreview={optimizeTextPreview}
                                setOptimizeTextPreview={setOptimizeTextPreview}
                                cloneFileName={cloneFileName}
                                setCloneFileName={setCloneFileName}
                                styleOpen={styleOpen}
                                setStyleOpen={setStyleOpen}
                                styleHistory={styleHistory}
                                setStyleHistory={setStyleHistory}
                                saveStyleToHistory={saveStyleToHistory}
                                deleteStyleFromHistory={deleteStyleFromHistory}
                            />

                            <TextInput
                                inputText={inputText}
                                setInputText={setInputText}
                                textareaRef={textareaRef}
                                tagsOpen={tagsOpen}
                                setTagsOpen={setTagsOpen}
                                onSynthesize={handleSynthesize}
                                onSynthesizeStream={handleSynthesizeStream}
                                onToggleStreamPause={handleToggleStreamPause}
                                onCancelStream={handleCancelStream}
                                isStreaming={isStreaming}
                                isStreamPaused={isStreamPaused}
                            />
                        </div>
                    </ScrollArea>

                    <HistoryPanel
                        tasks={tasks}
                        historyTotal={historyTotal}
                        historyPage={historyPage}
                        historyPageSize={historyPageSize}
                        historySearch={historySearch}
                        onHistorySearch={handleHistorySearch}
                        onPageChange={handlePageChange}
                        expandedTaskId={expandedTaskId}
                        setExpandedTaskId={setExpandedTaskId}
                        playingTaskId={playingTaskId}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={duration}
                        onPlay={playAudio}
                        onTogglePlay={handleTogglePlay}
                        onStop={handleStop}
                        onSeek={handleSeek}
                        onDelete={handleDeleteTask}
                        onClearCompleted={handleClearCompleted}
                        onDownload={handleDownload}
                    />
                </div>
            </main>

            <LogPanel
                logs={logs}
                setLogs={setLogs}
                logPanelOpen={logPanelOpen}
                setLogPanelOpen={setLogPanelOpen}
                logPanelHeight={logPanelHeight}
                setLogPanelHeight={setLogPanelHeight}
                logDragRef={logDragRef}
                logsEndRef={logsEndRef}
                handleLogDragStart={handleLogDragStart}
            />
        </div>
    )
}

export default App
