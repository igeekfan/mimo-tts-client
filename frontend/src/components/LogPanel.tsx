import {useI18n} from '../i18n/context'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Terminal, Trash2, ChevronUp, ChevronDown} from 'lucide-react'

interface LogPanelProps {
    logs: string[]
    setLogs: (logs: string[] | ((prev: string[]) => string[])) => void
    logPanelOpen: boolean
    setLogPanelOpen: (open: boolean) => void
    logPanelHeight: number
    setLogPanelHeight: (height: number) => void
    logDragRef: React.RefObject<{startY: number; startH: number} | null>
    logsEndRef: React.RefObject<HTMLDivElement | null>
    handleLogDragStart: (e: React.MouseEvent) => void
}

export default function LogPanel({
    logs, setLogs,
    logPanelOpen, setLogPanelOpen,
    logPanelHeight,
    logDragRef, logsEndRef, handleLogDragStart
}: LogPanelProps) {
    const {t} = useI18n()

    return (
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
                <span className="font-medium">{t('logs.title')}</span>
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
                        <span className="text-xs font-medium">{t('logs.output')}</span>
                        <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => setLogs([])}>
                            <Trash2 className="w-3 h-3 mr-0.5" />
                            <span className="text-[10px]">{t('common.clear')}</span>
                        </Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 font-mono text-[11px] space-y-0.5">
                            {logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                    <Terminal className="w-6 h-6 mb-1.5 opacity-50" />
                                    <p className="text-[10px]">{t('logs.empty')}</p>
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
                            <div ref={logsEndRef as React.RefObject<HTMLDivElement>} />
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
    )
}
