import {EventsOn as DesktopEventsOn} from '../../wailsjs/runtime/runtime'
import {getToken} from './webAuth'

const isDesktop = typeof window !== 'undefined' && typeof (window as any).go?.desktop?.App !== 'undefined'

type Listener = (data: any) => void

let webEventSource: EventSource | null = null
const webListeners = new Map<string, Set<Listener>>()
const webEventHandlers = new Map<string, EventListener>()

function ensureWebEventSource() {
    if (isDesktop || webEventSource) return false

    // EventSource cannot set headers, so pass the token as a query param.
    const token = getToken()
    const eventsURL = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'
    webEventSource = new EventSource(eventsURL)
    webEventHandlers.clear()
    for (const [eventName] of webListeners) {
        attachWebListener(eventName)
    }
    webEventSource.addEventListener('error', () => {
        if (webEventSource?.readyState === EventSource.CLOSED) {
            webEventSource = null
            webEventHandlers.clear()
        }
    })
    return true
}

function attachWebListener(eventName: string) {
    if (!webEventSource || webEventHandlers.has(eventName)) return
    const handler: EventListener = event => {
        const messageEvent = event as MessageEvent
        const listeners = webListeners.get(eventName)
        if (!listeners || listeners.size === 0) return

        let payload: any = messageEvent.data
        try {
            payload = JSON.parse(messageEvent.data)
        } catch {
        }

        for (const listener of listeners) {
            listener(payload)
        }
    }
    webEventHandlers.set(eventName, handler)
    webEventSource.addEventListener(eventName, handler)
}

function detachWebListener(eventName: string) {
    const handler = webEventHandlers.get(eventName)
    if (!handler) return
    webEventSource?.removeEventListener(eventName, handler)
    webEventHandlers.delete(eventName)
}

function closeWebEventSourceIfIdle() {
    for (const listeners of webListeners.values()) {
        if (listeners.size > 0) return
    }
    if (webEventSource) {
        webEventSource.close()
        webEventSource = null
        webEventHandlers.clear()
    }
}

export function EventsOn(eventName: string, callback: (data: any) => void) {
    if (isDesktop) {
        return DesktopEventsOn(eventName, callback)
    }

    const listeners = webListeners.get(eventName) || new Set<Listener>()
    const isNewEvent = !webListeners.has(eventName)
    listeners.add(callback)
    webListeners.set(eventName, listeners)
    const createdEventSource = ensureWebEventSource()
    if (isNewEvent && !createdEventSource) {
        attachWebListener(eventName)
    }

    return () => {
        const current = webListeners.get(eventName)
        if (!current) return
        current.delete(callback)
        if (current.size === 0) {
            webListeners.delete(eventName)
            detachWebListener(eventName)
        }
        closeWebEventSourceIfIdle()
    }
}
