import {createContext, useContext} from 'react'

interface LogContextType {
    logs: string[]
    setLogs: (logs: string[] | ((prev: string[]) => string[])) => void
    clearLogs: () => void
}

export const LogContext = createContext<LogContextType>({
    logs: [],
    setLogs: () => {},
    clearLogs: () => {},
})

export function useLogContext() {
    return useContext(LogContext)
}
