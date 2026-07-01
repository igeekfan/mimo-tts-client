import React from 'react'
import {createRoot} from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import LogPage from './components/LogPage'
import ErrorBoundary from './components/ErrorBoundary'
import {I18nProvider} from './i18n/context'
import {LogContext} from './lib/LogContext'
import {SettingsProvider, HistoryProvider, AudioPlayerProvider, InputProvider} from './lib/contexts'
import {useLogs} from './hooks/useLogs'
import {useRouter} from './hooks/useRouter'
import {Toaster} from '@/components/ui/sonner'
import {TooltipProvider} from '@/components/ui/tooltip'
import {initWebAuth} from './lib/webAuth'

function LogProvider({children}: {children: React.ReactNode}) {
    const {logs, setLogs, clearLogs} = useLogs()
    return (
        <LogContext.Provider value={{logs, setLogs, clearLogs}}>
            {children}
        </LogContext.Provider>
    )
}

function Router() {
    const {route, navigate} = useRouter()
    if (route === '/logs') {
        return <LogPage onBack={() => navigate('/')} />
    }
    return <App route={route} navigate={navigate} />
}

const container = document.getElementById('root')
const root = createRoot(container!)

function render() {
    root.render(
        <React.StrictMode>
            <I18nProvider>
                <TooltipProvider>
                    <LogProvider>
                        <SettingsProvider>
                            <HistoryProvider>
                                <AudioPlayerProvider>
                                    <InputProvider>
                                        <ErrorBoundary>
                                            <Router />
                                        </ErrorBoundary>
                                    </InputProvider>
                                </AudioPlayerProvider>
                            </HistoryProvider>
                        </SettingsProvider>
                    </LogProvider>
                </TooltipProvider>
                <Toaster position="bottom-center" />
            </I18nProvider>
        </React.StrictMode>
    )
}

// Resolve web auth (no-op on desktop / when no token is required) before the
// app issues its first API calls, then render.
initWebAuth().finally(render)
