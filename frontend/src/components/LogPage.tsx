import {useEffect, useRef} from 'react'
import {useI18n} from '../i18n/context'
import {useLogContext} from '../lib/LogContext'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Terminal, Trash2, ArrowLeft} from 'lucide-react'

interface LogPageProps {
    onBack: () => void
}

export default function LogPage({onBack}: LogPageProps) {
    const {t} = useI18n()
    const {logs, clearLogs} = useLogContext()
    const logsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({behavior: 'smooth'})
    }, [logs])

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onBack}>
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{t('common.back')}</span>
                    </Button>
                    <div className="w-px h-4 bg-border" />
                    <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                    <h1 className="text-sm font-semibold tracking-tight">{t('logs.title')}</h1>
                </div>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearLogs} disabled={logs.length === 0}>
                    <Trash2 className="w-3 h-3" />
                    <span>{t('common.clear')}</span>
                </Button>
            </header>

            <main className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-3 font-mono text-[11px] max-w-4xl mx-auto">
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                <Terminal className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">{t('logs.empty')}</p>
                            </div>
                        ) : (
                            <div className="space-y-px">
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-2 py-1 px-2 rounded hover:bg-muted/50 transition-colors group">
                                        <span className="text-muted-foreground/30 select-none shrink-0 w-8 text-right text-[10px] leading-relaxed">
                                            {i + 1}
                                        </span>
                                        <p className="text-muted-foreground break-all flex-1 leading-relaxed group-hover:text-foreground transition-colors">
                                            {log}
                                        </p>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </main>
        </div>
    )
}
