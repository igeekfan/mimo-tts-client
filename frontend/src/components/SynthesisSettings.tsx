import {useState, useCallback, useMemo} from 'react'
import {useI18n} from '../i18n/context'
import {ModelType} from '../types'
import {PRESET_VOICES, VOICE_DESIGN_EXAMPLES, STYLE_PRESETS, DIRECTOR_MODE_EXAMPLES} from '../lib/constants'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Badge} from '@/components/ui/badge'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Collapsible, CollapsibleTrigger, CollapsibleContent} from '@/components/ui/collapsible'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Trash2, Download, AlertTriangle, ChevronDown, Loader2} from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface SynthesisSettingsProps {
    model: ModelType
    setModel: (model: ModelType) => void
    voice: string
    setVoice: (voice: string) => void
    style: string
    setStyle: (style: string) => void
    directorMode: boolean
    setDirectorMode: (mode: boolean) => void
    directorRole: string
    setDirectorRole: (role: string) => void
    directorScene: string
    setDirectorScene: (scene: string) => void
    directorDirection: string
    setDirectorDirection: (direction: string) => void
    optimizeTextPreview: boolean
    setOptimizeTextPreview: (v: boolean) => void
    styleHistory: string[]
    setStyleHistory: (history: string[]) => void
    saveStyleToHistory: (style: string) => void
    deleteStyleFromHistory: (style: string) => void
}

export default function SynthesisSettings({
    model, setModel, voice, setVoice, style, setStyle,
    directorMode, setDirectorMode, directorRole, setDirectorRole,
    directorScene, setDirectorScene, directorDirection, setDirectorDirection,
    optimizeTextPreview, setOptimizeTextPreview,
    styleHistory, setStyleHistory,
    saveStyleToHistory, deleteStyleFromHistory
}: SynthesisSettingsProps) {
    const {t} = useI18n()
    const [styleOpen, setStyleOpen] = useState(false)
    const [cloneFileName, setCloneFileName] = useState('')
    const [cloneLoading, setCloneLoading] = useState(false)
    const [cloneError, setCloneError] = useState('')

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
            setCloneError(t('voice.fileTooLarge'))
            return
        }

        setCloneError('')
        setCloneLoading(true)
        setCloneFileName(file.name)

        // 使用 requestAnimationFrame 避免阻塞 UI
        requestAnimationFrame(() => {
            const reader = new FileReader()
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                setVoice(`data:${file.type || 'audio/mpeg'};base64,${base64}`)
                setCloneLoading(false)
            }
            reader.onerror = () => {
                setCloneError(t('voice.readFileError'))
                setCloneLoading(false)
                setCloneFileName('')
            }
            reader.readAsDataURL(file)
        })
    }, [t, setVoice])

    const handleClearFile = useCallback(() => {
        setVoice('')
        setCloneFileName('')
        setCloneError('')
    }, [setVoice])

    // 预置风格按分类分组，仅在 model / 语言变化时重算
    const styleGroups = useMemo(() => {
        const filtered = STYLE_PRESETS.filter(s => !s.ttsOnly || model === 'mimo-v2.5-tts')
        const groups: Record<string, typeof filtered> = {}
        filtered.forEach(s => { const cat = s.category || 'other'; if (!groups[cat]) groups[cat] = []; groups[cat].push(s) })
        const categoryLabels: Record<string, string> = {
            emotion: t('tags.emotion'), compound: t('tags.compound'), tone: t('tags.tone'),
            voice: t('voice'), persona: t('tags.persona'), dialect: t('tags.dialect'), other: t('tags.other'),
        }
        return Object.entries(groups).map(([cat, items]) => ({cat, label: categoryLabels[cat] || cat, items}))
    }, [model, t])

    return (
        <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
                {/* 标题 */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('synthesis.title')}</h3>

                {/* 模型选择 */}
                <div className="space-y-1">
                    <Label className="text-[11px] font-medium">{t('model')}</Label>
                    <Select value={model} onValueChange={v => { setModel(v as ModelType); setVoice(v === 'mimo-v2.5-tts' ? 'mimo_default' : ''); setCloneFileName('') }}>
                        <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue placeholder={t('model.select')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mimo-v2.5-tts">{t('model.preset')}</SelectItem>
                            <SelectItem value="mimo-v2.5-tts-voicedesign">{t('model.voiceDesign')}</SelectItem>
                            <SelectItem value="mimo-v2.5-tts-voiceclone">{t('model.voiceClone')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* 预置音色 */}
                {model === 'mimo-v2.5-tts' && (
                    <div className="space-y-1">
                        <Label className="text-[11px] font-medium">{t('voice')}</Label>
                        <Select value={voice} onValueChange={setVoice}>
                            <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue placeholder={t('voice.select')} />
                            </SelectTrigger>
                            <SelectContent>
                                {PRESET_VOICES.map(v => (
                                    <SelectItem key={v.voiceId} value={v.voiceId}>
                                        <div className="flex items-center gap-2">
                                            <span>{v.name}</span>
                                            <Badge variant="secondary" className="text-[9px] px-1">{v.language}</Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* 音色设计 */}
                {model === 'mimo-v2.5-tts-voicedesign' && (
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <Label className="text-[11px] font-medium">{t('voice.description')}</Label>
                            <textarea
                                className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none transition-colors"
                                value={voice}
                                onChange={e => setVoice(e.target.value)}
                                placeholder={t('voice.descriptionPlaceholder')}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t('common.quickSelect')}</Label>
                            <div className="flex flex-wrap gap-1">
                                {VOICE_DESIGN_EXAMPLES.map(ex => (
                                    <Badge
                                        key={ex}
                                        variant={voice === ex ? 'default' : 'outline'}
                                        className={`cursor-pointer text-[10px] px-1.5 py-0 transition-colors ${
                                            voice === ex
                                                ? 'hover:bg-primary/80'
                                                : 'hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                        onClick={() => setVoice(voice === ex ? '' : ex)}
                                    >
                                        {ex.length > 12 ? ex.slice(0, 12) + '...' : ex}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="optimize"
                                checked={optimizeTextPreview}
                                onCheckedChange={checked => setOptimizeTextPreview(checked === true)}
                                className="h-3 w-3"
                            />
                            <Label htmlFor="optimize" className="text-[11px] font-normal cursor-pointer">
                                {t('synthesis.smartPolish')}
                            </Label>
                        </div>
                    </div>
                )}

                {/* 音色复刻 */}
                {model === 'mimo-v2.5-tts-voiceclone' && (
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <Label className="text-[11px] font-medium">{t('voice.audioSample')}</Label>
                            <div className="flex items-center gap-1">
                                <Input
                                    type="file"
                                    accept="audio/mp3,audio/wav,audio/mpeg"
                                    className="flex-1 h-7 text-xs py-0 file:py-0.5"
                                    disabled={cloneLoading}
                                    onChange={handleFileChange}
                                />
                                {cloneFileName && (
                                    <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" disabled={cloneLoading} onClick={handleClearFile}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                            {cloneLoading && (
                                <p className="text-[10px] text-primary flex items-center gap-1">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    <span>{t('voice.loading')}</span>
                                </p>
                            )}
                            {cloneError && (
                                <p className="text-[10px] text-destructive">{cloneError}</p>
                            )}
                            {cloneFileName && !cloneLoading && !cloneError && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Download className="w-2.5 h-2.5" />
                                    <span className="truncate">{cloneFileName}</span>
                                </p>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">
                            {t('voice.supportedFormats')}：MP3, WAV | {t('voice.maxFileSize')}：10MB
                        </p>
                    </div>
                )}

                {/* 流式限制提示 */}
                {model !== 'mimo-v2.5-tts' && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{t('synthesis.streamLimitTip')}</span>
                    </div>
                )}

                {/* 风格设置 */}
                {model !== 'mimo-v2.5-tts-voicedesign' && (
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium">{t('style')}</Label>
                            <Button
                                variant={directorMode ? 'default' : 'outline'}
                                size="sm"
                                className="h-5 gap-0.5 text-[9px] px-1.5"
                                onClick={() => setDirectorMode(!directorMode)}
                            >
                                {t('style.directorMode')}
                            </Button>
                        </div>
                        {directorMode ? (
                            <div className="space-y-1.5">
                                {[
                                    {label: t('style.director.role'), value: directorRole, setter: setDirectorRole, ph: DIRECTOR_MODE_EXAMPLES.role},
                                    {label: t('style.director.scene'), value: directorScene, setter: setDirectorScene, ph: DIRECTOR_MODE_EXAMPLES.scene},
                                    {label: t('style.director.direction'), value: directorDirection, setter: setDirectorDirection, ph: DIRECTOR_MODE_EXAMPLES.direction},
                                ].map(f => (
                                    <div key={f.label} className="space-y-0.5">
                                        <Label className="text-[10px] font-medium">{f.label}</Label>
                                        <textarea
                                            className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-none transition-colors"
                                            value={f.value}
                                            onChange={e => f.setter(e.target.value)}
                                            placeholder={f.ph}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Input
                                    value={style}
                                    onChange={e => setStyle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveStyleToHistory(style) }}}
                                    placeholder={t('style.placeholder')}
                                    className="h-7 text-xs"
                                />
                                <Collapsible open={styleOpen} onOpenChange={setStyleOpen}>
                                    <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                                        <ChevronDown className={`h-3 w-3 transition-transform ${styleOpen ? 'rotate-180' : ''}`} />
                                        {t('common.quickSelect')}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-1.5 space-y-1.5">
                                        {styleGroups.map(({cat, label, items}) => (
                                            <div key={cat} className="space-y-0.5">
                                                <p className="text-[9px] text-muted-foreground/50 font-medium">{label}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {items.map(s => (
                                                        <Badge
                                                            key={s.value}
                                                            variant={style === s.value ? 'default' : 'outline'}
                                                            className={`cursor-pointer text-[10px] px-1.5 py-0 transition-colors ${
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
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                                {styleHistory.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t('style.history')}</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-4 px-1 text-[9px] text-muted-foreground hover:text-foreground"
                                                onClick={() => setStyleHistory([])}
                                            >
                                                {t('common.clear')}
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {styleHistory.map(s => (
                                                <div key={s} className="flex items-center gap-0.5 group">
                                                    <Badge
                                                        variant={style === s ? 'default' : 'outline'}
                                                        className={`cursor-pointer text-[9px] px-1 py-0 transition-colors ${
                                                            style === s
                                                                ? 'hover:bg-primary/80'
                                                                : 'hover:bg-accent hover:text-accent-foreground'
                                                        }`}
                                                        onClick={() => setStyle(style === s ? '' : s)}
                                                    >
                                                        {s.length > 6 ? s.slice(0, 6) + '...' : s}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => deleteStyleFromHistory(s)}
                                                    >
                                                        <Trash2 className="h-2 w-2" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ScrollArea>
    )
}
