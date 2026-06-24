import {useState, useEffect} from 'react'
import {useI18n} from '../i18n/context'
import {AUDIO_TAGS} from '../lib/constants'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Collapsible, CollapsibleTrigger, CollapsibleContent} from '@/components/ui/collapsible'
import {Volume2, Play, Pause, Square, ChevronDown, Loader2} from 'lucide-react'

interface TextInputProps {
    inputText: string
    setInputText: (text: string | ((prev: string) => string)) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    onSynthesize: () => void
    onSynthesizeStream: () => void
    onToggleStreamPause: () => void
    onCancelSynthesize: () => void
    onCancelStream: () => void
    isSynthesizing: boolean
    isStreaming: boolean
    isStreamPaused: boolean
}

export default function TextInput({
    inputText, setInputText, textareaRef,
    onSynthesize, onSynthesizeStream, onToggleStreamPause, onCancelSynthesize, onCancelStream,
    isSynthesizing, isStreaming, isStreamPaused
}: TextInputProps) {
    const {t} = useI18n()
    const [tagsOpen, setTagsOpen] = useState(false)

    // 流式合成时自动滚动到光标位置
    useEffect(() => {
        if (isStreaming && textareaRef.current) {
            const ta = textareaRef.current
            ta.scrollTop = ta.scrollHeight
        }
    }, [inputText, isStreaming, textareaRef])

    return (
        <div className="space-y-2">
            {/* 输入区 */}
            <textarea
                ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                className="flex min-h-[100px] max-h-[200px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-y transition-colors whitespace-pre-wrap break-words"
                placeholder={t('input.placeholder')}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
            />

            {/* 音频标签 */}
            <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className={`h-3 w-3 transition-transform ${tagsOpen ? 'rotate-180' : ''}`} />
                    {t('input.audioTags')}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                    {(() => {
                        const categories = [
                            { label: t('tags.rhythm'), tags: AUDIO_TAGS.filter(a => ['[吸气]','[深呼吸]','[叹气]','[长叹一口气]','[喘息]','[屏息]'].includes(a.tag)) },
                            { label: t('tags.emotion'), tags: AUDIO_TAGS.filter(a => ['[紧张]','[害怕]','[激动]','[疲惫]','[委屈]','[撒娇]','[心虚]','[震惊]','[不耐烦]'].includes(a.tag)) },
                            { label: t('tags.feature'), tags: AUDIO_TAGS.filter(a => ['[颤抖]','[变调]','[破音]','[鼻音]','[气声]'].includes(a.tag)) },
                            { label: t('tags.laughCry'), tags: AUDIO_TAGS.filter(a => ['[笑]','[轻笑]','[大笑]','[冷笑]','[抽泣]','[呜咽]','[哽咽]','[嚎啕大哭]'].includes(a.tag)) },
                        ]
                        return categories.map(cat => (
                            <div key={cat.label} className="space-y-1">
                                <p className="text-[10px] text-muted-foreground/60 font-medium">{cat.label}</p>
                                <div className="flex flex-wrap gap-1">
                                    {cat.tags.map(at => (
                                        <Badge
                                            key={at.tag}
                                            variant="outline"
                                            className="cursor-pointer text-[10px] px-1.5 py-0 hover:bg-accent hover:text-accent-foreground transition-colors"
                                            onClick={() => {
                                                const ta = textareaRef.current
                                                if (ta) {
                                                    const start = ta.selectionStart
                                                    const end = ta.selectionEnd
                                                    const newText = inputText.slice(0, start) + at.tag + inputText.slice(end)
                                                    setInputText(newText)
                                                    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + at.tag.length; ta.focus() }, 0)
                                                } else {
                                                    setInputText(prev => prev + at.tag)
                                                }
                                            }}
                                        >
                                            {at.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))
                    })()}
                </CollapsibleContent>
            </Collapsible>

            {/* 操作按钮 */}
            <div className="flex gap-2">
                <Button
                    className="flex-1 h-8 text-xs font-medium"
                    onClick={onSynthesize}
                    disabled={!inputText.trim() || isStreaming || isSynthesizing}
                >
                    {isSynthesizing ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isSynthesizing ? t('synthesis.synthesizing') : t('synthesis.synthesize')}
                </Button>
                <Button
                    className="flex-1 h-8 text-xs font-medium"
                    variant="outline"
                    onClick={isStreaming ? onToggleStreamPause : onSynthesizeStream}
                    disabled={!inputText.trim() && !isStreaming}
                >
                    {isStreaming ? (
                        isStreamPaused ? <Play className="w-3.5 h-3.5 mr-1.5" /> : <Pause className="w-3.5 h-3.5 mr-1.5" />
                    ) : (
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isStreaming ? (isStreamPaused ? t('common.resume') : t('common.pause')) : t('synthesis.stream')}
                </Button>
                {(isSynthesizing || isStreaming) && (
                    <Button
                        variant="destructive"
                        className="h-8 text-xs font-medium"
                        onClick={isStreaming ? onCancelStream : onCancelSynthesize}
                    >
                        <Square className="w-3.5 h-3.5 mr-1.5" />
                        {t('common.cancel')}
                    </Button>
                )}
            </div>

            {/* 字数统计 */}
            <div className="flex items-center justify-end">
                <span className="text-[10px] text-muted-foreground">
                    {inputText.length} {t('input.characters')}
                </span>
            </div>
        </div>
    )
}
