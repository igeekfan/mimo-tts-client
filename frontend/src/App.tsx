import {useState, useEffect, useCallback, useRef} from 'react'
import {SynthesizeSpeech, SynthesizeSpeechStream, GetSettings, SaveSettings, SearchHistory, SaveToHistory, GetHistoryAudio, DeleteHistory, ClearHistory, CheckForUpdate, GetAboutInfo, OpenReleasePage} from './lib/backend'
import {EventsOn} from './lib/runtime'
import {useI18n} from './i18n/context'
import {ModelType, SynthesisTask, VoicePreset, AboutInfo, UpdateInfo} from './types'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Badge} from '@/components/ui/badge'
import {Checkbox} from '@/components/ui/checkbox'
import {Separator} from '@/components/ui/separator'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Pagination} from '@/components/ui/pagination'
import {toast} from 'sonner'
import {Volume2, Download, Trash2, Play, Pause, Square, Sun, Moon, Mic, Settings, AlertTriangle, Terminal, ChevronUp, ChevronDown, ExternalLink, Globe, Mail, RefreshCw, GitFork} from 'lucide-react'
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
                    <Dialog open={apiSettingsOpen} onOpenChange={setApiSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                                <Settings className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t('设置')}</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[480px]">
                            <DialogHeader><DialogTitle>{t('设置')}</DialogTitle></DialogHeader>
                            <Tabs defaultValue="settings" className="mt-4">
                                <TabsList className="w-full">
                                    <TabsTrigger value="settings" className="flex-1">{t('设置')}</TabsTrigger>
                                    <TabsTrigger value="about" className="flex-1">{t('关于')}</TabsTrigger>
                                </TabsList>
                                <TabsContent value="settings" className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-muted-foreground">{t('外观')}</h4>
                                        <div className="space-y-2">
                                            <Label>{t('主题')}</Label>
                                            <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark')}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="dark">{t('深色')}</SelectItem>
                                                    <SelectItem value="light">{t('浅色')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('语言')}</Label>
                                            <Select value={lang} onValueChange={v => setLang(v as 'zh-CN' | 'en-US')}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="zh-CN">简体中文</SelectItem>
                                                    <SelectItem value="en-US">English</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-muted-foreground">{t('API 配置')}</h4>
                                        <div className="space-y-2">
                                            <Label>{t('API Key')}</Label>
                                            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={t('请输入 API Key')} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('Base URL')}</Label>
                                            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={t('请输入 Base URL')} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <span className="text-xs text-muted-foreground italic">{t('设置自动保存')}</span>
                                    </div>
                                </TabsContent>
                                <TabsContent value="about">
                                    <Card>
                                        <CardHeader className="text-center">
                                            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                                                <Mic className="h-6 w-6 text-primary-foreground" />
                                            </div>
                                            <CardTitle>MiMo TTS</CardTitle>
                                            {aboutInfo && (
                                                <Badge variant="secondary" className="w-fit mx-auto">v{aboutInfo.appVersion}</Badge>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {aboutInfo && (
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <GitFork className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{t('开源项目')}:</span>
                                                        <a href={aboutInfo.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                                            {aboutInfo.githubRepo} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-nowrap">
                                                        <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        <span className="text-muted-foreground whitespace-nowrap">{t('系统版本')}:</span>
                                                        <span>{aboutInfo.systemVersion}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{t('作者邮箱')}:</span>
                                                        <a href={`mailto:${aboutInfo.authorEmail}`} className="text-primary">{aboutInfo.authorEmail}</a>
                                                    </div>
                                                </div>
                                            )}
                                            <Separator />
                                            <div className="flex flex-col items-center gap-2">
                                                <Button onClick={handleCheckUpdate} disabled={updateLoading} variant="outline" size="sm">
                                                    <RefreshCw className={`w-4 h-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`} />
                                                    {updateLoading ? t('检查中...') : t('检查更新')}
                                                </Button>
                                                {updateInfo?.hasUpdate && (
                                                    <Button onClick={handleOpenReleasePage} size="sm">
                                                        <Download className="w-4 h-4 mr-2" />
                                                        {t('下载更新')}
                                                    </Button>
                                                )}
                                                {updateInfo && !updateInfo.hasUpdate && !updateLoading && (
                                                    <span className="text-xs text-muted-foreground">{t('已是最新版本', {version: updateInfo.currentVersion})}</span>
                                                )}
                                                {updateError && <span className="text-xs text-destructive">{updateError}</span>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
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
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-3 px-4 pt-4">
                                    <CardTitle className="text-sm font-medium">{t('合成设置')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 px-4 pb-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">{t('模型')}</Label>
                                        <Select value={model} onValueChange={v => { setModel(v as ModelType); setVoice(v === 'mimo-v2.5-tts' ? 'mimo_default' : ''); setCloneFileName('') }}>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder={t('选择模型')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mimo-v2.5-tts">{t('预置音色')}</SelectItem>
                                                <SelectItem value="mimo-v2.5-tts-voicedesign">{t('音色设计')}</SelectItem>
                                                <SelectItem value="mimo-v2.5-tts-voiceclone">{t('音色复刻')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {model === 'mimo-v2.5-tts' && (
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">{t('音色')}</Label>
                                            <Select value={voice} onValueChange={setVoice}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder={t('选择音色')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PRESET_VOICES.map(v => (
                                                        <SelectItem key={v.voiceId} value={v.voiceId}>
                                                            <div className="flex items-center gap-2">
                                                                <span>{v.name}</span>
                                                                <Badge variant="secondary" className="text-[10px] px-1">{v.language}</Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {model === 'mimo-v2.5-tts-voicedesign' && (
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">{t('音色描述')}</Label>
                                                <textarea
                                                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none transition-colors"
                                                    value={voice}
                                                    onChange={e => setVoice(e.target.value)}
                                                    placeholder={t('如: 年轻女性，声音温柔甜美，语速适中')}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('快速选择')}</Label>
                                                <div className="flex flex-wrap gap-1">
                                                    {VOICE_DESIGN_EXAMPLES.map(ex => (
                                                        <Badge 
                                                            key={ex} 
                                                            variant={voice === ex ? 'default' : 'outline'} 
                                                            className={`cursor-pointer text-[10px] px-1.5 py-0.5 transition-colors ${
                                                                voice === ex 
                                                                    ? 'hover:bg-primary/80' 
                                                                    : 'hover:bg-accent hover:text-accent-foreground'
                                                            }`}
                                                            onClick={() => setVoice(voice === ex ? '' : ex)}
                                                        >
                                                            {ex.length > 15 ? ex.slice(0, 15) + '...' : ex}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox 
                                                    id="optimize" 
                                                    checked={optimizeTextPreview} 
                                                    onCheckedChange={checked => setOptimizeTextPreview(checked === true)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <Label htmlFor="optimize" className="text-xs font-normal cursor-pointer">
                                                    {t('智能润色')}
                                                    <span className="text-[10px] text-muted-foreground ml-1">
                                                        ({t('合成文本将自动润色')})
                                                    </span>
                                                </Label>
                                            </div>
                                        </div>
                                    )}

                                    {model === 'mimo-v2.5-tts-voiceclone' && (
                                        <div className="space-y-2">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">{t('音频样本')}</Label>
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        type="file"
                                                        accept="audio/mp3,audio/wav,audio/mpeg"
                                                        className="flex-1 h-8 text-xs"
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
                                                    {cloneFileName && (
                                                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setVoice(''); setCloneFileName('') }}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                                {cloneFileName && (
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Download className="w-3 h-3" />
                                                        {cloneFileName}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                                                <p className="text-[10px] text-muted-foreground">
                                                    {t('支持格式')}：MP3, WAV | {t('最大文件大小')}：10MB
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {model !== 'mimo-v2.5-tts' && (
                                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                            <span>{t('流式限制提示')}</span>
                                        </div>
                                    )}

                                    {model !== 'mimo-v2.5-tts-voicedesign' && (
                                        <>
                                            <Separator className="my-1" />
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-medium">{t('风格')}</Label>
                                                    <Button 
                                                        variant={directorMode ? 'default' : 'outline'} 
                                                        size="sm"
                                                        className="h-6 gap-1 text-[10px] px-2"
                                                        onClick={() => setDirectorMode(!directorMode)}
                                                    >
                                                        {t('导演模式')}
                                                    </Button>
                                                </div>
                                                {directorMode ? (
                                                    <div className="space-y-2">
                                                        {[
                                                            {label: t('角色'), value: directorRole, setter: setDirectorRole, ph: DIRECTOR_MODE_EXAMPLES.role},
                                                            {label: t('场景'), value: directorScene, setter: setDirectorScene, ph: DIRECTOR_MODE_EXAMPLES.scene},
                                                            {label: t('指导'), value: directorDirection, setter: setDirectorDirection, ph: DIRECTOR_MODE_EXAMPLES.direction},
                                                        ].map(f => (
                                                            <div key={f.label} className="space-y-1">
                                                                <Label className="text-[10px] font-medium">{f.label}</Label>
                                                                <textarea
                                                                    className="flex min-h-[48px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none transition-colors"
                                                                    value={f.value}
                                                                    onChange={e => f.setter(e.target.value)}
                                                                    placeholder={f.ph}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <Input
                                                            value={style}
                                                            onChange={e => setStyle(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveStyleToHistory(style) }}}
                                                            placeholder={t('如: 用轻快上扬的语调，语速稍快')}
                                                            className="h-8 text-xs"
                                                        />
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('快速选择')}</Label>
                                                            <div className="flex flex-wrap gap-1">
                                                                {STYLE_PRESETS.map(s => (
                                                                    <Badge 
                                                                        key={s.value} 
                                                                        variant={style === s.value ? 'default' : 'outline'} 
                                                                        className={`cursor-pointer text-[10px] px-1.5 py-0.5 transition-colors ${
                                                                            style === s.value 
                                                                                ? 'hover:bg-primary/80' 
                                                                                : 'hover:bg-accent hover:text-accent-foreground'
                                                                        }`}
                                                                        onClick={() => setStyle(style === s.value ? '' : s.value)}
                                                                    >
                                                                        {s.label}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {styleHistory.length > 0 && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('历史风格')}</Label>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                                                        onClick={() => setStyleHistory([])}
                                                                    >
                                                                        {t('清除')}
                                                                    </Button>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {styleHistory.map(s => (
                                                                        <div key={s} className="flex items-center gap-0.5 group">
                                                                            <Badge 
                                                                                variant={style === s ? 'default' : 'outline'} 
                                                                                className={`cursor-pointer text-[10px] px-1.5 py-0.5 transition-colors ${
                                                                                    style === s 
                                                                                        ? 'hover:bg-primary/80' 
                                                                                        : 'hover:bg-accent hover:text-accent-foreground'
                                                                                }`}
                                                                                onClick={() => setStyle(style === s ? '' : s)}
                                                                            >
                                                                                {s.length > 8 ? s.slice(0, 8) + '...' : s}
                                                                            </Badge>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onClick={() => deleteStyleFromHistory(s)}
                                                                            >
                                                                                <Trash2 className="h-2.5 w-2.5" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-2 px-4 pt-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium">{t('文本输入')}</CardTitle>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-muted-foreground">
                                                {inputText.length} {t('字符')}
                                            </span>
                                            {inputText.length > 0 && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                                    onClick={() => setInputText('')}
                                                >
                                                    {t('清空')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 px-4 pb-4">
                                    <textarea
                                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-y transition-colors"
                                        placeholder={t('请输入要合成的文本...')}
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button 
                                            className="flex-1 h-8 text-xs font-medium" 
                                            onClick={handleSynthesize} 
                                            disabled={!inputText.trim() || isStreaming}
                                        >
                                            <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                                            {t('合成语音')}
                                        </Button>
                                        <Button 
                                            className="flex-1 h-8 text-xs font-medium" 
                                            variant="outline" 
                                            onClick={isStreaming ? handleToggleStreamPause : handleSynthesizeStream} 
                                            disabled={!inputText.trim() && !isStreaming}
                                        >
                                            {isStreaming ? (
                                                isStreamPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />
                                            ) : (
                                                <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                                            )}
                                            {isStreaming ? (isStreamPaused ? t('继续') : t('暂停')) : t('流式合成')}
                                        </Button>
                                        {isStreaming && (
                                            <Button 
                                                variant="destructive" 
                                                className="h-8 text-xs font-medium"
                                                onClick={handleCancelStream}
                                            >
                                                <Square className="w-3.5 h-3.5 mr-1.5" />
                                                {t('取消')}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>

                    <Card className="flex flex-col border-0 shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-semibold">{t('合成记录')}</h3>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                    {historyTotal}
                                </Badge>
                            </div>
                            {tasks.some(t => t.status === 'completed') && (
                                <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('清除已完成')}</span>
                                </Button>
                            )}
                        </div>
                        <div className="px-3 py-1.5 border-b">
                            <Input
                                placeholder={t('搜索历史记录')}
                                value={historySearch}
                                onChange={e => handleHistorySearch(e.target.value)}
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
                                        <p className="text-xs font-medium">{t('暂无合成记录')}</p>
                                        <p className="text-[10px] mt-0.5">{t('开始合成你的第一段语音')}</p>
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
                                                                onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }}
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
                                                                    onClick={() => playingTaskId === task.id ? handleTogglePlay() : playAudio(task)}
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
                                                                            onClick={handleStop}
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
                                                                                onChange={handleSeek} 
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
                                                                    onClick={() => handleDownload(task)}
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
                                                onPageChange={handlePageChange}
                                                className="pt-1 pb-2"
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
            </main>

            <div className="fixed bottom-0 right-3 z-50 flex flex-col items-end">
                <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-t-md text-xs transition-all duration-150 ${
                        logPanelOpen 
                            ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                            : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => setLogPanelOpen(!logPanelOpen)}
                >
                    <Terminal className="w-3.5 h-3.5" />
                    <span className="font-medium">{t('日志')}</span>
                    {logs.length > 0 && (
                        <Badge 
                            variant={logPanelOpen ? 'secondary' : 'destructive'} 
                            className="h-4 min-w-[16px] px-1 text-[9px] font-bold"
                        >
                            {logs.length > 99 ? '99+' : logs.length}
                        </Badge>
                    )}
                    {logPanelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
                {logPanelOpen && (
                    <div 
                        className="w-[min(600px,calc(100vw-24px))] bg-background border border-border rounded-tl-lg flex flex-col overflow-hidden shadow-xl"
                        style={{height: logPanelHeight}}
                    >
                        <div 
                            className="h-1.5 cursor-ns-resize shrink-0 hover:bg-primary/20 transition-colors flex items-center justify-center"
                            onMouseDown={handleLogDragStart}
                        >
                            <div className="w-6 h-0.5 rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                            <span className="text-xs font-medium">{t('日志输出')}</span>
                            <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => setLogs([])}>
                                <Trash2 className="w-3 h-3 mr-0.5" />
                                <span className="text-[10px]">{t('清空')}</span>
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 font-mono text-[11px] space-y-0.5">
                                {logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                        <Terminal className="w-6 h-6 mb-1.5 opacity-50" />
                                        <p className="text-[10px]">{t('暂无日志')}</p>
                                    </div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className="flex gap-1.5 py-0.5 border-b border-muted/30 last:border-0">
                                            <span className="text-muted-foreground/40 select-none shrink-0 w-6 text-right">
                                                {i + 1}
                                            </span>
                                            <p className="text-muted-foreground break-all flex-1 leading-tight">
                                                {log}
                                            </p>
                                        </div>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
