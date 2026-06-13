import {useState, useEffect, useCallback, useRef} from 'react'
import {SynthesizeSpeech, SynthesizeSpeechStream, GetSettings, SaveSettings, GetHistory, SaveToHistory, GetHistoryAudio, DeleteHistory, ClearHistory} from './lib/backend'
import {EventsOn} from './lib/runtime'
import {useI18n} from './i18n/context'
import {ModelType, SynthesisTask, VoicePreset, HistoryItem} from './types'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {toast} from 'sonner'
import {Volume2, Download, Trash2, Play, Pause, Square, Sun, Moon, Mic, Settings, Save} from 'lucide-react'
import './App.css'

const PRESET_VOICES: VoicePreset[] = [
    {name: '冰糖', voiceId: '冰糖', language: 'zh-CN', gender: 'female'},
    {name: '茉莉', voiceId: '茉莉', language: 'zh-CN', gender: 'female'},
    {name: '苏打', voiceId: '苏打', language: 'zh-CN', gender: 'male'},
    {name: '白桦', voiceId: '白桦', language: 'zh-CN', gender: 'male'},
    {name: 'Mia', voiceId: 'Mia', language: 'en-US', gender: 'female'},
    {name: 'Chloe', voiceId: 'Chloe', language: 'en-US', gender: 'female'},
    {name: 'Milo', voiceId: 'Milo', language: 'en-US', gender: 'male'},
    {name: 'Dean', voiceId: 'Dean', language: 'en-US', gender: 'male'},
    {name: '默认', voiceId: 'mimo_default', language: 'zh-CN', gender: 'female'},
]

const VOICE_DESIGN_EXAMPLES = [
    '年轻女性，声音温柔甜美，语速适中',
    '成熟男性，声音低沉磁性，语速稍慢',
    '少女，声音清脆活泼，带点俏皮',
    '老年男性，声音沧桑有力，语速缓慢',
]

const STYLE_PRESETS = [
    {label: '开心', value: '开心'},
    {label: '悲伤', value: '悲伤'},
    {label: '愤怒', value: '愤怒'},
    {label: '温柔', value: '温柔'},
    {label: '高冷', value: '高冷'},
    {label: '活泼', value: '活泼'},
    {label: '严肃', value: '严肃'},
    {label: '慵懒', value: '慵懒'},
    {label: '磁性', value: '磁性'},
    {label: '东北话', value: '东北话'},
    {label: '四川话', value: '四川话'},
    {label: '粤语', value: '粤语'},
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
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [isStreamPaused, setIsStreamPaused] = useState(false)
    const streamAbortRef = useRef<AbortController | null>(null)
    const [apiSettingsOpen, setApiSettingsOpen] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
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
        }).catch(console.error)

        GetHistory().then(async (items) => {
            const loadedTasks: SynthesisTask[] = []
            for (const item of items) {
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
        }).catch(console.error)
    }, [])

    const handleSaveSettings = useCallback(async () => {
        try {
            await SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style})
            toast.success(t('设置已保存'))
        } catch (err: any) {
            toast.error(err.message)
        }
    }, [theme, lang, apiKey, baseUrl, model, voice, style, t])

    useEffect(() => {
        const timer = setTimeout(() => {
            SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style}).catch(console.error)
        }, 500)
        return () => clearTimeout(timer)
    }, [lang, theme, apiKey, baseUrl, model, voice, style])

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

        audio.onloadedmetadata = () => {
            setDuration(audio.duration)
        }
        audio.onended = () => {
            stopCurrentAudio()
        }
        audio.onplay = () => {
            setIsPlaying(true)
            updateProgress()
        }
        audio.onpause = () => {
            setIsPlaying(false)
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
                animFrameRef.current = null
            }
        }

        audio.play()
        setPlayingTaskId(task.id)
    }, [volume, stopCurrentAudio])

    const handleTogglePlay = useCallback(() => {
        if (!audioRef.current) return
        if (isPlaying) {
            audioRef.current.pause()
        } else {
            audioRef.current.play()
        }
    }, [isPlaying])

    const handleStop = useCallback(() => {
        stopCurrentAudio()
    }, [stopCurrentAudio])

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return
        const time = parseFloat(e.target.value)
        audioRef.current.currentTime = time
        setCurrentTime(time)
    }, [])

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value)
        setVolume(vol)
        if (audioRef.current) {
            audioRef.current.volume = vol
        }
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

    const handleSynthesize = useCallback(async () => {
        if (!inputText.trim()) {
            toast.error(t('请输入文本'))
            return
        }
        const taskId = createTaskId()
        const currentStyle = buildStyleContent()
        const newTask: SynthesisTask = {
            id: taskId,
            text: inputText,
            model,
            voice,
            style: currentStyle || undefined,
            status: 'synthesizing',
            progress: 0,
            createdAt: new Date().toISOString(),
        }
        setTasks(prev => [newTask, ...prev])
        try {
            const result = await SynthesizeSpeech(inputText, model, voice, currentStyle)
            if (result.error) {
                setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: result.error} : t))
                toast.error(result.error)
                return
            }
            const binaryString = atob(result.audioData)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], {type: 'audio/wav'})
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'completed', progress: 100, audioBlob: blob} : t))
            toast.success(t('合成完成'))

            SaveToHistory(inputText, model, voice, currentStyle || '', result.audioData, 'wav').catch(console.error)

            playAudio({...newTask, status: 'completed', progress: 100, audioBlob: blob})
        } catch (err: any) {
            setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: err.message} : t))
            toast.error(err.message)
        }
    }, [inputText, model, voice, style, t, playAudio])

    const handleSynthesizeStream = useCallback(async () => {
        if (!inputText.trim()) {
            toast.error(t('请输入文本'))
            return
        }
        const taskId = createTaskId()
        const currentStyle = buildStyleContent()
        const newTask: SynthesisTask = {
            id: taskId,
            text: inputText,
            model,
            voice,
            style: currentStyle || undefined,
            status: 'synthesizing',
            progress: 0,
            createdAt: new Date().toISOString(),
        }
        setTasks(prev => [newTask, ...prev])
        setIsStreaming(true)
        setIsStreamPaused(false)
        setPlayingTaskId(taskId)
        setIsPlaying(true)

        const abortController = new AbortController()
        streamAbortRef.current = abortController

        try {
            const audioContext = new AudioContext({sampleRate: 24000})
            await audioContext.resume()
            audioContextRef.current = audioContext
            const pcmChunks: Uint8Array[] = []
            let totalLength = 0
            let nextStartTime = audioContext.currentTime + 0.1
            let chunkCount = 0

            for await (const chunk of SynthesizeSpeechStream(inputText, model, voice, currentStyle)) {
                if (abortController.signal.aborted) {
                    break
                }
                
                while (isStreamPaused && !abortController.signal.aborted) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
                
                if (abortController.signal.aborted) {
                    break
                }

                pcmChunks.push(chunk)
                totalLength += chunk.length
                chunkCount++

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

                setTasks(prev => prev.map(t => t.id === taskId ? {...t, progress: Math.min(90, (totalLength / 1000))} : t))
            }

            if (abortController.signal.aborted) {
                await audioContext.close()
                audioContextRef.current = null
                setTasks(prev => prev.map(task => task.id === taskId ? {...task, status: 'error', error: t('合成已取消')} : task))
                return
            }

            const fullPcm = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of pcmChunks) {
                fullPcm.set(chunk, offset)
                offset += chunk.length
            }

            const wavData = addWavHeader(fullPcm)
            const blob = new Blob([wavData.buffer as ArrayBuffer], {type: 'audio/wav'})

            const remainingTime = (nextStartTime - audioContext.currentTime) * 1000
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime + 200))
            }
            await audioContext.close()
            audioContextRef.current = null

            const completedTask = {...newTask, status: 'completed' as const, progress: 100, audioBlob: blob}
            setTasks(prev => prev.map(t => t.id === taskId ? completedTask : t))
            toast.success(t('合成完成'))
            SaveToHistory(inputText, model, voice, currentStyle || '', wavData, 'wav').catch(console.error)
        } catch (err: any) {
            if (!abortController.signal.aborted) {
                setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: 'error', error: err.message} : t))
                toast.error(err.message)
            }
        } finally {
            setIsStreaming(false)
            setIsStreamPaused(false)
            setPlayingTaskId(null)
            setIsPlaying(false)
            audioContextRef.current = null
            streamAbortRef.current = null
        }
    }, [inputText, model, voice, style, t])

    const handleToggleStreamPause = useCallback(() => {
        if (audioContextRef.current) {
            if (isStreamPaused) {
                audioContextRef.current.resume()
            } else {
                audioContextRef.current.suspend()
            }
            setIsStreamPaused(!isStreamPaused)
        }
    }, [isStreamPaused])

    const handleCancelStream = useCallback(() => {
        if (streamAbortRef.current) {
            streamAbortRef.current.abort()
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        setIsStreaming(false)
        setIsStreamPaused(false)
        setPlayingTaskId(null)
        setIsPlaying(false)
    }, [])

    const handleDownload = useCallback((task: SynthesisTask) => {
        if (!task.audioBlob) return
        const url = URL.createObjectURL(task.audioBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tts_${task.voice}_${Date.now()}.wav`
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    const handleDeleteTask = useCallback((taskId: string) => {
        if (playingTaskId === taskId) {
            stopCurrentAudio()
        }
        const task = tasks.find(t => t.id === taskId)
        if (task?.dbId) {
            DeleteHistory(task.dbId).catch(console.error)
        }
        setTasks(prev => prev.filter(t => t.id !== taskId))
    }, [playingTaskId, tasks, stopCurrentAudio])

    const handleClearCompleted = useCallback(() => {
        if (playingTaskId && tasks.find(t => t.id === playingTaskId)?.status === 'completed') {
            stopCurrentAudio()
        }
        ClearHistory().catch(console.error)
        setTasks(prev => prev.filter(t => t.status !== 'completed'))
    }, [playingTaskId, tasks, stopCurrentAudio])

    useEffect(() => {
        return () => {
            stopCurrentAudio()
        }
    }, [])

    return (
        <div className={`app-container ${theme}`}>
            <header className="app-header">
                <div className="header-left">
                    <Mic className="header-icon" />
                    <h1>MiMo TTS</h1>
                </div>
                <div className="header-right">
                    <Dialog open={apiSettingsOpen} onOpenChange={setApiSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Settings />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="settings-dialog">
                            <DialogHeader>
                                <DialogTitle>{t('设置')}</DialogTitle>
                            </DialogHeader>
                            <div className="settings-sections">
                                <div className="settings-section">
                                    <h3>{t('外观')}</h3>
                                    <div className="form-field">
                                        <Label>{t('主题')}</Label>
                                        <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark')}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dark">{t('深色')}</SelectItem>
                                                <SelectItem value="light">{t('浅色')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="form-field">
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
                                <div className="settings-section">
                                    <h3>{t('API 配置')}</h3>
                                    <div className="form-field">
                                        <Label>{t('API Key')}</Label>
                                        <Input
                                            type="password"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                            placeholder={t('请输入 API Key')}
                                        />
                                    </div>
                                    <div className="form-field">
                                        <Label>{t('Base URL')}</Label>
                                        <Input
                                            value={baseUrl}
                                            onChange={e => setBaseUrl(e.target.value)}
                                            placeholder={t('请输入 Base URL')}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="settings-footer">
                                <span className="auto-save-hint">{t('设置自动保存')}</span>
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

            <main className="app-main">
                <div className="main-grid">
                    <div className="left-panel">
                        <div className="panel-section">
                            <h3>{t('合成设置')}</h3>
                            <div className="form-row">
                                <div className="form-field">
                                    <Label>{t('模型')}</Label>
                                    <Select value={model} onValueChange={v => setModel(v as ModelType)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mimo-v2.5-tts">{t('预置音色')}</SelectItem>
                                            <SelectItem value="mimo-v2.5-tts-voicedesign">{t('音色设计')}</SelectItem>
                                            <SelectItem value="mimo-v2.5-tts-voiceclone">{t('音色复刻')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="form-field">
                                    {model === 'mimo-v2.5-tts' ? (
                                        <>
                                            <Label>{t('音色')}</Label>
                                            <Select value={voice} onValueChange={setVoice}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {PRESET_VOICES.map(v => (
                                                        <SelectItem key={v.voiceId} value={v.voiceId}>
                                                            {v.name} ({v.language})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </>
                                    ) : model === 'mimo-v2.5-tts-voicedesign' ? (
                                        <>
                                            <Label>{t('音色描述')}</Label>
                                            <Input
                                                value={voice}
                                                onChange={e => setVoice(e.target.value)}
                                                placeholder={t('如: 年轻女性，声音温柔甜美')}
                                            />
                                            <div className="style-tags">
                                                {VOICE_DESIGN_EXAMPLES.map(ex => (
                                                    <Button
                                                        key={ex}
                                                        variant={voice === ex ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setVoice(voice === ex ? '' : ex)}
                                                    >
                                                        {ex.slice(0, 10)}...
                                                    </Button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Label>{t('音频样本')}</Label>
                                            <Input
                                                type="file"
                                                accept="audio/*"
                                                onChange={e => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = () => {
                                                            const base64 = (reader.result as string).split(',')[1]
                                                            setVoice(`data:audio/mpeg;base64,${base64}`)
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="form-field">
                                <div className="style-header">
                                    <Label>{t('风格')}</Label>
                                    <Button
                                        variant={directorMode ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setDirectorMode(!directorMode)}
                                    >
                                        {t('导演模式')}
                                    </Button>
                                </div>
                                {directorMode ? (
                                    <div className="director-mode">
                                        <div className="director-field">
                                            <Label>{t('角色')}</Label>
                                            <textarea
                                                className="director-input"
                                                value={directorRole}
                                                onChange={e => setDirectorRole(e.target.value)}
                                                placeholder={DIRECTOR_MODE_EXAMPLES.role}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="director-field">
                                            <Label>{t('场景')}</Label>
                                            <textarea
                                                className="director-input"
                                                value={directorScene}
                                                onChange={e => setDirectorScene(e.target.value)}
                                                placeholder={DIRECTOR_MODE_EXAMPLES.scene}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="director-field">
                                            <Label>{t('指导')}</Label>
                                            <textarea
                                                className="director-input"
                                                value={directorDirection}
                                                onChange={e => setDirectorDirection(e.target.value)}
                                                placeholder={DIRECTOR_MODE_EXAMPLES.direction}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            value={style}
                                            onChange={e => setStyle(e.target.value)}
                                            placeholder={t('如: 用轻快上扬的语调，语速稍快')}
                                        />
                                        <div className="style-tags">
                                            {STYLE_PRESETS.map(s => (
                                                <Button
                                                    key={s.value}
                                                    variant={style === s.value ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setStyle(style === s.value ? '' : s.value)}
                                                >
                                                    {s.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="panel-section">
                            <div className="text-header">
                                <h3>{t('文本输入')}</h3>
                                <span className="char-count">{inputText.length} {t('字符')}</span>
                            </div>
                            <textarea
                                className="text-input"
                                placeholder={t('请输入要合成的文本...')}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                rows={4}
                            />
                            <div className="synth-buttons">
                                <Button
                                    className="synthesize-btn"
                                    onClick={handleSynthesize}
                                    disabled={!inputText.trim() || isStreaming}
                                >
                                    <Volume2 className="btn-icon" />
                                    {t('合成语音')}
                                </Button>
                                <Button
                                    className="synthesize-btn stream-btn"
                                    onClick={isStreaming ? handleToggleStreamPause : handleSynthesizeStream}
                                    disabled={!inputText.trim() && !isStreaming}
                                    variant="outline"
                                >
                                    {isStreaming ? (
                                        isStreamPaused ? <Play className="btn-icon" /> : <Pause className="btn-icon" />
                                    ) : (
                                        <Volume2 className="btn-icon" />
                                    )}
                                    {isStreaming ? (isStreamPaused ? t('继续') : t('暂停')) : t('流式合成')}
                                </Button>
                                {isStreaming && (
                                    <Button
                                        className="synthesize-btn cancel-btn"
                                        onClick={handleCancelStream}
                                        variant="destructive"
                                    >
                                        <Square className="btn-icon" />
                                        {t('取消')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="right-panel">
                        <div className="tasks-header">
                            <h3>{t('合成记录')}</h3>
                            {tasks.some(t => t.status === 'completed') && (
                                <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
                                    <Trash2 className="btn-icon" />
                                </Button>
                            )}
                        </div>
                        <div className="tasks-list">
                            {tasks.length === 0 ? (
                                <div className="empty-state">
                                    <Mic className="empty-icon" />
                                    <p>{t('暂无合成记录')}</p>
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <div key={task.id} className={`task-item ${task.status} ${expandedTaskId === task.id ? 'expanded' : ''} ${playingTaskId === task.id ? 'playing' : ''}`}>
                                        <div className="task-content" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                            <div className="task-text">
                                                {expandedTaskId === task.id ? task.text : (task.text.slice(0, 80) + (task.text.length > 80 ? '...' : ''))}
                                            </div>
                                            <div className="task-meta">
                                                <span>{task.voice}</span>
                                                {task.style && <span>· {task.style}</span>}
                                            </div>
                                        </div>
                                        <div className="task-actions">
                                            {task.status === 'synthesizing' && <div className="loading-spinner" />}
                                            {task.status === 'error' && <span className="error-text">{task.error}</span>}
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)}>
                                                <Trash2 />
                                            </Button>
                                        </div>
                                        {expandedTaskId === task.id && task.status === 'completed' && task.audioBlob && (
                                            <div className="task-player" onClick={e => e.stopPropagation()}>
                                                <div className="player-controls">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        if (playingTaskId === task.id) {
                                                            handleTogglePlay()
                                                        } else {
                                                            playAudio(task)
                                                        }
                                                    }}>
                                                        {playingTaskId === task.id && isPlaying ? <Pause /> : <Play />}
                                                    </Button>
                                                    {playingTaskId === task.id && (
                                                        <>
                                                            <Button variant="ghost" size="icon" onClick={handleStop}>
                                                                <Square />
                                                            </Button>
                                                            <span className="time-display">{formatTime(currentTime)}</span>
                                                            <input
                                                                type="range"
                                                                className="progress-bar"
                                                                min={0}
                                                                max={duration || 0}
                                                                step={0.1}
                                                                value={currentTime}
                                                                onChange={handleSeek}
                                                            />
                                                            <span className="time-display">{formatTime(duration)}</span>
                                                        </>
                                                    )}
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownload(task)}>
                                                        <Download />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="log-panel">
                    <div className="log-header">
                        <h3>{t('日志')}</h3>
                        <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                            <Trash2 className="btn-icon" />
                        </Button>
                    </div>
                    <div className="log-content">
                        {logs.length === 0 ? (
                            <div className="log-empty">{t('暂无日志')}</div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="log-line">{log}</div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </main>
        </div>
    )
}

export default App
