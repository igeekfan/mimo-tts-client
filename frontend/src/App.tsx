import {useCallback} from 'react'
import {useI18n} from './i18n/context'
import {useLogContext} from './lib/LogContext'
import {Button} from '@/components/ui/button'
import SettingsDialog from './components/SettingsDialog'
import SynthesisPage from './components/SynthesisPage'
import HistoryPage from './components/HistoryPage'
import {useSettingsContext} from './lib/contexts'
import {Mic, Sun, Moon, Terminal, Type, History} from 'lucide-react'
import './App.css'

interface AppProps {
    route: string
    navigate: (path: string) => void
}

function App({route, navigate}: AppProps) {
    const {t} = useI18n()
    const settings = useSettingsContext()
    const {logs} = useLogContext()

    const {lang, setLang, theme, setTheme} = settings
    const goHome = useCallback(() => navigate('/'), [navigate])
    const goHistory = useCallback(() => navigate('/history'), [navigate])
    const goLogs = useCallback(() => navigate('/logs'), [navigate])
    const toggleLang = useCallback(() => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN'), [lang, setLang])
    const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

    return (
        <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
            <header className="flex justify-between items-center px-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 h-10">
                {/* 左侧 Logo */}
                <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                        <Mic className="w-3 h-3 text-primary-foreground" />
                    </div>
                    <span className="text-xs font-semibold tracking-tight">MiMo TTS</span>
                </div>

                {/* 中间 Tabs - 使用下划线样式 */}
                <nav className="flex items-center h-full">
                    <button
                        className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                            route === '/'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                        }`}
                        onClick={goHome}
                    >
                        <Type className="w-3 h-3" />
                        {t('input.title')}
                    </button>
                    <button
                        className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                            route === '/history'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                        }`}
                        onClick={goHistory}
                    >
                        <History className="w-3 h-3" />
                        {t('history.title')}
                    </button>
                </nav>

                {/* 右侧工具栏 */}
                <div className="flex items-center gap-1">
                    <SettingsDialog
                        open={settings.apiSettingsOpen}
                        onOpenChange={settings.setApiSettingsOpen}
                        theme={settings.theme}
                        setTheme={settings.setTheme}
                        lang={settings.lang}
                        setLang={settings.setLang}
                        apiKey={settings.apiKey}
                        setApiKey={settings.setApiKey}
                        baseUrl={settings.baseUrl}
                        setBaseUrl={settings.setBaseUrl}
                        aboutInfo={settings.aboutInfo}
                        updateInfo={settings.updateInfo}
                        updateLoading={settings.updateLoading}
                        updateError={settings.updateError}
                        handleCheckUpdate={settings.checkUpdate}
                        handleOpenReleasePage={settings.openReleasePage}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={toggleLang}>
                        <span className="text-[10px] font-medium">{settings.lang === 'zh-CN' ? 'EN' : '中'}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground relative" onClick={goLogs}>
                        <Terminal className="w-3 h-3" />
                        {logs.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[7px] font-bold px-0.5">
                                {logs.length > 99 ? '99+' : logs.length}
                            </span>
                        )}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={toggleTheme}>
                        {settings.theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                    </Button>
                </div>
            </header>

            {/* 路由分发 - 只渲染当前页面的组件 */}
            {route === '/history' ? <HistoryPage navigate={navigate} /> : <SynthesisPage />}
        </div>
    )
}

export default App
