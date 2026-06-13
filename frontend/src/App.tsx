import {useState, useEffect, useCallback, useRef} from 'react'
import {SynthesizeSpeech, SynthesizeSpeechStream, GetSettings, SaveSettings, SearchHistory, SaveToHistory, GetHistoryAudio, DeleteHistory, ClearHistory} from './lib/backend'
import {EventsOn} from './lib/runtime'
import {useI18n} from './i18n/context'
import {ModelType, SynthesisTask, VoicePreset} from './types'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {toast} from 'sonner'
import {Volume2, Download, Trash2, Play, Pause, Square, Sun, Moon, Mic, Settings, AlertTriangle, Terminal, ChevronUp, ChevronDown} from 'lucide-react'
import './App.css'

const PRESET_VOICES: VoicePreset[] = [
    {name: '默认', voiceId: 'mimo_default', language: 'zh-CN', gender: 'female'},
    {name: '冰糖', voiceId: '冰糖', language: 'zh-CN', gender: 'female'},
    {name: '茉莉', voiceId: '茉莉', language: 'zh-CN', gender: 'female'},
    {name: '苏打', voiceId: '苏打', language: 'zh-CN', gender: 'male'},
    {name: '白桦', voiceId: '白桦', language: 'zh-CN', gender: 'male'},
    {name: 'Mia', voiceId: 'Mia', language: 'en-US', gender: 'female'},
    {name: 'Chloe', voiceId: 'Chloe', language: 'en-US', gender: 'female'},
    {name: 'Milo', voiceId: 'Milo', language: 'en-US', gender: 'male'},
    {name: 'Dean', voiceId: 'Dean', language: 'en-US', gender: 'male'},
]

const VOICE_DESIGN_EXAMPLES = [
    '年轻女性，声音温柔甜美，语速适中',
    '成熟男性，声音低沉磁性，语速稍慢',
    'Heavy Russian accent, gruff middle-aged male',
    '少女，声音清脆活泼，带点俏皮',
    '一位年迈的老先生，嗓音略带沙哑和沧桑感',
    'Young female, ASMR feel, speaks very slowly',
]

const STYLE_PRESETS = [
    {label: '开心', value: '开心'}, {label: '悲伤', value: '悲伤'}, {label: '愤怒', value: '愤怒'},
    {label: '温柔', value: '温柔'}, {label: '高冷', value: '高冷'}, {label: '活泼', value: '活泼'},
    {label: '严肃', value: '严肃'}, {label: '慵懒', value: '慵懒'}, {label: '磁性', value: '磁性'},
    {label: '甜美', value: '甜美'}, {label: '沙哑', value: '沙哑'}, {label: '空灵', value: '空灵'},
    {label: '东北话', value: '东北话'}, {label: '四川话', value: '四川话'}, {label: '粤语', value: '粤语'},
    {label: '唱歌', value: '唱歌'},
]

const DIRECTOR_MODE_EXAMPLES = {
    role: '百年门阀的现任大当家，自幼被塑造成完美无瑕的家族图腾，常年深居简出',
    scene: '在祠堂的阴影里，看着不顾一切冲来找她的男人，要用最冷硬的阶级壁垒绞杀对方',
    direction: '冰冷慵懒的低音御姐，语速极慢，每个字都像在舌尖滚过才吐出来，带着上位者的傲慢'
}

let taskIdCounter = 0
function createTaskId(): string {
    return `task_${Date.now()}_${++taskIdCounter}`
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

function addWavHeader(pcmData: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
    const byteRate = sampleRate * channels * bitsPerSample / 8
    const blockAlign = channels * bitsPerSample / 8
    const dataSize = pcmData.length
    const fileSize = 36 + dataSize
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    writeString(view, 0, 'RIFF')
    view.setUint32(4, fileSize, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    const uint8 = new Uint8Array(buffer)
    uint8.set(pcmData, 44)
    return uint8
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}

function App() {
    const {t, lang, setLang} = useI18n()
    const [inputText, setInputText] = useState('')
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
    const [historyOffset, setHistoryOffset] = useState(0)
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

        loadHistory('', 0, true)
    }, [])

    const loadHistory = useCallback(async (query: string, offset: number, replace: boolean) => {
        try {
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
            setTasks(prev => replace ? loadedTasks : [...prev, ...loadedTasks])
            setHistoryTotal(result.total)
            setHistoryOffset(offset + result.items.length)
        } catch (e) {
            console.error('Failed to load history:', e)
        }
    }, [historyPageSize])

    const handleSaveSettings = useCallback(async () => {
        try {
            await SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style, styleHistory})
            toast.success(t('设置已保存'))
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
        loadHistory(query, 0, true)
    }, [loadHistory])

    const handleLoadMore = useCallback(() => {
        loadHistory(historySearch, historyOffset, false)
    }, [loadHistory, historySearch, historyOffset])

    const handleSynthesize = useCallback(async () => {
        if (!inputText.trim()) { toast.error(t('请输入文本')); return }
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
            toast.success(t('合成完成'))
            SaveToHistory(inputText, model, voice, currentStyle || '', result.audioData, 'wav').catch(console.error)
            playAudio({...newTask, status: 'completed', progress: 100, audioBlob: blob})
        } catch (err: any) {
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: err.message} : t))
            toast.error(err.message)
        }
    }, [inputText, model, voice, style, t, playAudio])

    const handleSynthesizeStream = useCallback(async () => {
        if (!inputText.trim()) { toast.error(t('请输入文本')); return }
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
                setTasks(prev => prev.map(task => task.id === taskId ? {...task, status: 'error', error: t('合成已取消')} : task))
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
            toast.success(t('合成完成'))
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
        setHistoryTotal(0); setHistoryOffset(0)
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

    const inputCls = "w-full px-3 py-2 rounded-md border border-border bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent)] resize-none font-inherit"
    const tagCls = "flex flex-wrap gap-1.5 mt-2"

    return (
        <div className={`min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
            <header className="flex justify-between items-center px-5 py-3 border-b border-border bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2.5">
                    <Mic className="w-6 h-6 text-[var(--accent)]" />
                    <h1 className="text-lg font-semibold">MiMo TTS</h1>
                </div>
                <div className="flex items-center gap-1">
                    <Dialog open={apiSettingsOpen} onOpenChange={setApiSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Settings /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[450px]">
                            <DialogHeader><DialogTitle>{t('设置')}</DialogTitle></DialogHeader>
                            <div className="flex flex-col gap-6 pt-2">
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pb-1 border-b border-border">{t('外观')}</h3>
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-[var(--text-secondary)]">{t('主题')}</Label>
                                        <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark')}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dark">{t('深色')}</SelectItem>
                                                <SelectItem value="light">{t('浅色')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-[var(--text-secondary)]">{t('语言')}</Label>
                                        <Select value={lang} onValueChange={v => setLang(v as 'zh-CN' | 'en-US')}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="zh-CN">简体中文</SelectItem>
                                                <SelectItem value="en-US">English</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pb-1 border-b border-border">{t('API 配置')}</h3>
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-[var(--text-secondary)]">{t('API Key')}</Label>
                                        <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={t('请输入 API Key')} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-[var(--text-secondary)]">{t('Base URL')}</Label>
                                        <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={t('请输入 Base URL')} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <span className="text-xs text-[var(--text-secondary)] italic">{t('设置自动保存')}</span>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')}>
                        {lang === 'zh-CN' ? 'EN' : '中'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun /> : <Moon />}
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-4 overflow-hidden flex flex-col relative">
                <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                    <div className="flex flex-col gap-4 overflow-y-auto">
                        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-border">
                            <h3 className="text-sm font-semibold mb-3">{t('合成设置')}</h3>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs text-[var(--text-secondary)]">{t('模型')}</Label>
                                <Select value={model} onValueChange={v => { setModel(v as ModelType); setVoice(v === 'mimo-v2.5-tts' ? 'mimo_default' : ''); setCloneFileName('') }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mimo-v2.5-tts">{t('预置音色')}</SelectItem>
                                        <SelectItem value="mimo-v2.5-tts-voicedesign">{t('音色设计')}</SelectItem>
                                        <SelectItem value="mimo-v2.5-tts-voiceclone">{t('音色复刻')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {model === 'mimo-v2.5-tts' && (
                                <div className="flex flex-col gap-1.5 mt-3">
                                    <Label className="text-xs text-[var(--text-secondary)]">{t('音色')}</Label>
                                    <Select value={voice} onValueChange={setVoice}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PRESET_VOICES.map(v => (
                                                <SelectItem key={v.voiceId} value={v.voiceId}>{v.name} ({v.language})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {model === 'mimo-v2.5-tts-voicedesign' && (
                                <div className="flex flex-col gap-1.5 mt-3">
                                    <Label className="text-xs text-[var(--text-secondary)]">{t('音色描述')}</Label>
                                    <textarea className={`${inputCls} min-h-[72px]`} value={voice} onChange={e => setVoice(e.target.value)} placeholder={t('如: 年轻女性，声音温柔甜美')} rows={3} />
                                    <div className={tagCls}>
                                        {VOICE_DESIGN_EXAMPLES.map(ex => (
                                            <Button key={ex} variant={voice === ex ? 'default' : 'outline'} size="sm" onClick={() => setVoice(voice === ex ? '' : ex)} title={ex}>
                                                {ex.length > 15 ? ex.slice(0, 15) + '...' : ex}
                                            </Button>
                                        ))}
                                    </div>
                                    <label className="flex items-center gap-2 mt-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                                        <input type="checkbox" checked={optimizeTextPreview} onChange={e => setOptimizeTextPreview(e.target.checked)} className="w-4 h-4 accent-[var(--accent)] cursor-pointer" />
                                        {t('智能润色')}
                                        <span className="text-[11px] opacity-70">{t('合成文本将自动润色')}</span>
                                    </label>
                                </div>
                            )}

                            {model === 'mimo-v2.5-tts-voiceclone' && (
                                <div className="flex flex-col gap-1.5 mt-3">
                                    <Label className="text-xs text-[var(--text-secondary)]">{t('音频样本')}</Label>
                                    <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                            <input type="file" accept="audio/mp3,audio/wav,audio/mpeg" className="absolute w-0 h-0 opacity-0 pointer-events-none"
                                                onChange={e => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        setCloneFileName(file.name)
                                                        const reader = new FileReader()
                                                        reader.onload = () => {
                                                            const base64 = (reader.result as string).split(',')[1]
                                                            setVoice(`data:${file.type || 'audio/mpeg'};base64,${base64}`)
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                            <span className="inline-flex items-center justify-center h-9 px-3.5 rounded-md border border-border bg-[var(--bg-tertiary)] text-sm whitespace-nowrap hover:border-[var(--accent)] transition-colors">{t('选择文件')}</span>
                                            <span className="text-sm text-[var(--text-secondary)] truncate">{cloneFileName || t('未选择文件')}</span>
                                        </label>
                                        {cloneFileName && (
                                            <Button variant="ghost" size="sm" onClick={() => { setVoice(''); setCloneFileName('') }}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-[var(--text-secondary)] opacity-70">MP3 / WAV, ≤10MB</span>
                                </div>
                            )}

                            {model !== 'mimo-v2.5-tts' && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-[var(--warning)] text-[var(--warning)] text-xs mt-3">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                                    <span>{t('流式限制提示')}</span>
                                </div>
                            )}

                            {model !== 'mimo-v2.5-tts-voicedesign' && (
                                <div className="flex flex-col gap-1.5 mt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <Label className="text-xs text-[var(--text-secondary)]">{t('风格')}</Label>
                                        <Button variant={directorMode ? 'default' : 'outline'} size="sm" onClick={() => setDirectorMode(!directorMode)}>
                                            {t('导演模式')}
                                        </Button>
                                    </div>
                                    {directorMode ? (
                                        <div className="flex flex-col gap-3">
                                            {[
                                                {label: t('角色'), value: directorRole, setter: setDirectorRole, ph: DIRECTOR_MODE_EXAMPLES.role},
                                                {label: t('场景'), value: directorScene, setter: setDirectorScene, ph: DIRECTOR_MODE_EXAMPLES.scene},
                                                {label: t('指导'), value: directorDirection, setter: setDirectorDirection, ph: DIRECTOR_MODE_EXAMPLES.direction},
                                            ].map(f => (
                                                <div key={f.label} className="flex flex-col gap-1">
                                                    <Label className="text-xs text-[var(--text-secondary)]">{f.label}</Label>
                                                    <textarea className={inputCls} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.ph} rows={2} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <Input value={style} onChange={e => setStyle(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveStyleToHistory(style) }}}
                                                placeholder={t('如: 用轻快上扬的语调，语速稍快')}
                                            />
                                            <div className={tagCls}>
                                                {STYLE_PRESETS.map(s => (
                                                    <Button key={s.value} variant={style === s.value ? 'default' : 'outline'} size="sm" onClick={() => setStyle(style === s.value ? '' : s.value)}>
                                                        {s.label}
                                                    </Button>
                                                ))}
                                            </div>
                                            {styleHistory.length > 0 && (
                                                <div className="mt-2">
                                                    <span className="text-[11px] text-[var(--text-secondary)] opacity-70">{t('历史风格')}</span>
                                                    <div className={tagCls}>
                                                        {styleHistory.map(s => (
                                                            <div key={s} className="relative inline-flex items-center group">
                                                                <Button variant={style === s ? 'default' : 'outline'} size="sm" className="pr-5" onClick={() => setStyle(style === s ? '' : s)}>
                                                                    {s.length > 10 ? s.slice(0, 10) + '...' : s}
                                                                </Button>
                                                                <button
                                                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-none bg-transparent text-[var(--text-secondary)] text-xs flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-[var(--error)] hover:text-white transition-all cursor-pointer"
                                                                    onClick={e => { e.stopPropagation(); deleteStyleFromHistory(s) }}
                                                                    title={t('删除')}
                                                                >×</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-border">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-semibold">{t('文本输入')}</h3>
                                <span className="text-xs text-[var(--text-secondary)]">{inputText.length} {t('字符')}</span>
                            </div>
                            <textarea
                                className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-[var(--bg-tertiary)] text-sm resize-y outline-none focus:border-[var(--accent)] font-inherit mb-3"
                                placeholder={t('请输入要合成的文本...')}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                rows={4}
                            />
                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleSynthesize} disabled={!inputText.trim() || isStreaming}>
                                    <Volume2 className="w-4 h-4 mr-2" />{t('合成语音')}
                                </Button>
                                <Button className="flex-1" variant="outline" onClick={isStreaming ? handleToggleStreamPause : handleSynthesizeStream} disabled={!inputText.trim() && !isStreaming}>
                                    {isStreaming ? (isStreamPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />) : <Volume2 className="w-4 h-4 mr-2" />}
                                    {isStreaming ? (isStreamPaused ? t('继续') : t('暂停')) : t('流式合成')}
                                </Button>
                                {isStreaming && (
                                    <Button variant="destructive" className="flex-[0.5]" onClick={handleCancelStream}>
                                        <Square className="w-4 h-4 mr-2" />{t('取消')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col bg-[var(--bg-secondary)] rounded-xl border border-border overflow-hidden">
                        <div className="flex justify-between items-center px-4 py-3 border-b border-border">
                            <h3 className="text-sm font-semibold">{t('合成记录')}</h3>
                            {tasks.some(t => t.status === 'completed') && (
                                <Button variant="ghost" size="sm" onClick={handleClearCompleted}><Trash2 className="w-4 h-4" /></Button>
                            )}
                        </div>
                        <div className="px-3 py-2 border-b border-border">
                            <input
                                className="w-full h-8 px-2.5 rounded-md border border-border bg-[var(--bg-tertiary)] text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] placeholder:opacity-60"
                                type="text" placeholder={t('搜索历史记录')} value={historySearch} onChange={e => handleHistorySearch(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-15 text-[var(--text-secondary)]">
                                    <Mic className="w-10 h-10 mb-3 opacity-50" />
                                    <p>{t('暂无合成记录')}</p>
                                </div>
                            ) : (
                                <>
                                    {tasks.map(task => (
                                        <div key={task.id} className={`flex flex-wrap justify-between items-center p-2.5 rounded-lg border mb-2 transition-all ${task.status === 'error' ? 'border-[var(--error)]' : playingTaskId === task.id ? 'border-[var(--accent)]' : 'border-border'} bg-[var(--bg-tertiary)] ${expandedTaskId === task.id ? 'bg-[var(--bg-secondary)]' : ''}`}>
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                                <div className="text-[13px] whitespace-pre-wrap break-all leading-relaxed">
                                                    {expandedTaskId === task.id ? task.text : (task.text.slice(0, 80) + (task.text.length > 80 ? '...' : ''))}
                                                </div>
                                                <div className="flex gap-1 mt-0.5 text-[11px] text-[var(--text-secondary)]">
                                                    <span>{task.voice}</span>
                                                    {task.style && <span>· {task.style}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                                {task.status === 'synthesizing' && <div className="w-[18px] h-[18px] border-2 border-border border-t-[var(--accent)] rounded-full animate-spin" />}
                                                {task.status === 'error' && <span className="text-[11px] text-[var(--error)] max-w-[150px] truncate">{task.error}</span>}
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}><Trash2 /></Button>
                                            </div>
                                            {expandedTaskId === task.id && task.status === 'completed' && task.audioBlob && (
                                                <div className="w-full pt-2 mt-2 border-t border-border" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => playingTaskId === task.id ? handleTogglePlay() : playAudio(task)}>
                                                            {playingTaskId === task.id && isPlaying ? <Pause /> : <Play />}
                                                        </Button>
                                                        {playingTaskId === task.id && (
                                                            <>
                                                                <Button variant="ghost" size="icon" onClick={handleStop}><Square /></Button>
                                                                <span className="text-xs text-[var(--text-secondary)] min-w-[35px] text-center tabular-nums">{formatTime(currentTime)}</span>
                                                                <input type="range" className="flex-1 h-1 bg-border rounded outline-none cursor-pointer accent-[var(--accent)]" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek} />
                                                                <span className="text-xs text-[var(--text-secondary)] min-w-[35px] text-center tabular-nums">{formatTime(duration)}</span>
                                                            </>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={() => handleDownload(task)}><Download /></Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {tasks.length < historyTotal && (
                                        <Button variant="outline" size="sm" className="w-full mt-1" onClick={handleLoadMore}>
                                            {t('加载更多')} ({tasks.length}/{historyTotal})
                                        </Button>
                                    )}
                                    {tasks.length >= historyTotal && tasks.length > 0 && (
                                        <div className="text-center text-xs text-[var(--text-secondary)] opacity-60 py-3">{t('暂无更多记录')}</div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <div className={`fixed bottom-0 right-4 z-50 flex flex-col items-end ${logPanelOpen ? '' : ''}`}>
                <div
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 border border-border border-b-0 rounded-t-lg cursor-pointer select-none text-xs transition-colors ${logPanelOpen ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                    onClick={() => setLogPanelOpen(!logPanelOpen)}
                >
                    <Terminal className="w-3.5 h-3.5" />
                    <span className="font-medium">{t('日志')}</span>
                    {logs.length > 0 && (
                        <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold ${logPanelOpen ? 'bg-white/30' : 'bg-[var(--error)] text-white'}`}>
                            {logs.length > 99 ? '99+' : logs.length}
                        </span>
                    )}
                    {logPanelOpen ? <ChevronDown className="w-3 h-3 opacity-70" /> : <ChevronUp className="w-3 h-3 opacity-70" />}
                </div>
                {logPanelOpen && (
                    <div className="w-[min(600px,calc(100vw-32px))] bg-[var(--bg-secondary)] border border-border rounded-tl-lg flex flex-col overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" style={{height: logPanelHeight}}>
                        <div className="h-1.5 cursor-ns-resize shrink-0 hover:bg-[var(--accent)] transition-colors" onMouseDown={handleLogDragStart} />
                        <div className="flex justify-end px-2 py-0.5 border-b border-border shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => setLogs([])}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
                            {logs.length === 0 ? (
                                <div className="text-[var(--text-secondary)] text-center py-5">{t('暂无日志')}</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="py-0.5 whitespace-pre-wrap break-all text-[var(--text-secondary)] border-b border-border last:border-b-0">{log}</div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
