import {useState, useEffect, useCallback} from 'react'
import {EventsOn} from '../lib/runtime'

export function useLogs() {
    const [logs, setLogs] = useState<string[]>([])

    useEffect(() => {
        const off = EventsOn('app:log', (msg: string) => {
            setLogs(prev => [...prev.slice(-200), msg])
        })
        return off
    }, [])

    const clearLogs = useCallback(() => setLogs([]), [])

    return {logs, setLogs, clearLogs}
}
