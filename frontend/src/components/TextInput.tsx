import {useI18n} from '../i18n/context'
import {AUDIO_TAGS} from '../lib/constants'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Collapsible, CollapsibleTrigger, CollapsibleContent} from '@/components/ui/collapsible'
import {Volume2, Play, Pause, Square, ChevronDown} from 'lucide-react'

interface TextInputProps {
    inputText: string
    setInputText: (text: string | ((prev: string) => string)) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    tagsOpen: boolean
    setTagsOpen: (open: boolean) => void
    onSynthesize: () => void
    onSynthesizeStream: () => void
    onToggleStreamPause: () => void
    onCancelStream: () => void
    isStreaming: boolean
    isStreamPaused: boolean
}

export default function TextInput({
    inputText, setInputText, textareaRef,
    tagsOpen, setTagsOpen,
    onSynthesize, onSynthesizeStream, onToggleStreamPause, onCancelStream,
    isStreaming, isStreamPaused
}: TextInputProps) {
    const {t} = useI18n()

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 px-4 pt-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{t('input.title')}</CardTitle>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                            {inputText.length} {t('input.characters')}
                        </span>
                        {inputText.length > 0 && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                onClick={() => setInputText('')}
                            >
                                {t('common.clear')}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
                <textarea
                    ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-y transition-colors"
                    placeholder={t('input.placeholder')}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                />
                <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tagsOpen ? 'rotate-180' : ''}`} />
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
                                    <p className="text-[10px] text-muted-foreground/70 font-medium">{cat.label}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {cat.tags.map(at => (
                                            <Badge 
                                                key={at.tag} 
                                                variant="outline" 
                                                className="cursor-pointer text-xs px-2 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
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
                <div className="flex gap-2">
                    <Button 
                        className="flex-1 h-8 text-xs font-medium" 
                        onClick={onSynthesize} 
                        disabled={!inputText.trim() || isStreaming}
                    >
                        <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                        {t('synthesis.synthesize')}
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
                    {isStreaming && (
                        <Button 
                            variant="destructive" 
                            className="h-8 text-xs font-medium"
                            onClick={onCancelStream}
                        >
                            <Square className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.cancel')}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
