import React, {useEffect, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import LogPage from './components/LogPage'
import ErrorBoundary from './components/ErrorBoundary'
import {I18nProvider, useI18n} from './i18n/context'
import {LogContext} from './lib/LogContext'
import {SettingsProvider, HistoryProvider, AudioPlayerProvider, InputProvider} from './lib/contexts'
import {useLogs} from './hooks/useLogs'
import {useRouter} from './hooks/useRouter'
import {Toaster} from '@/components/ui/sonner'
import {TooltipProvider} from '@/components/ui/tooltip'
import {initWebAuth} from './lib/webAuth'

function LogProvider({children}: {children: React.ReactNode}) {
    const {logs, setLogs, clearLogs} = useLogs()
    const value = useMemo(() => ({logs, setLogs, clearLogs}), [logs, setLogs, clearLogs])
    return (
        <LogContext.Provider value={value}>
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

function AuthGate({children}: {children: React.ReactNode}) {
    const {t} = useI18n()
    const [ready, setReady] = useState(false)
    const promptMessage = t('auth.tokenPrompt')

    useEffect(() => {
        let active = true
        void initWebAuth(promptMessage).finally(() => {
            if (active) setReady(true)
        })
        return () => { active = false }
    }, [promptMessage])

    return ready ? children : null
}

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <I18nProvider>
            <AuthGate>
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
            </AuthGate>
        </I18nProvider>
    </React.StrictMode>
)
