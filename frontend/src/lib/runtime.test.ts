import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../../wailsjs/runtime/runtime', () => ({
    EventsOn: vi.fn(),
}))

class FakeEventSource {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2
    static instances: FakeEventSource[] = []

    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSED = 2
    readonly url: string
    readonly withCredentials = false
    readyState = FakeEventSource.OPEN
    onerror: ((this: EventSource, event: Event) => unknown) | null = null
    onmessage: ((this: EventSource, event: MessageEvent) => unknown) | null = null
    onopen: ((this: EventSource, event: Event) => unknown) | null = null
    private listeners = new Map<string, Array<(event: MessageEvent) => void>>()

    constructor(url: string | URL) {
        this.url = String(url)
        FakeEventSource.instances.push(this)
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (!listener) return
        const callback = typeof listener === 'function'
            ? listener as (event: MessageEvent) => void
            : (event: MessageEvent) => listener.handleEvent(event)
        const callbacks = this.listeners.get(type) || []
        callbacks.push(callback)
        this.listeners.set(type, callbacks)
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
        if (!listener) return
        const callback = typeof listener === 'function'
            ? listener as (event: MessageEvent) => void
            : (event: MessageEvent) => listener.handleEvent(event)
        this.listeners.set(type, (this.listeners.get(type) || []).filter(candidate => candidate !== callback))
    }

    dispatchEvent(): boolean {
        return true
    }

    close() {
        this.readyState = FakeEventSource.CLOSED
    }

    listenerCount(type: string): number {
        return this.listeners.get(type)?.length || 0
    }

    emit(type: string, data: string) {
        const event = {data} as MessageEvent
        for (const listener of this.listeners.get(type) || []) listener(event)
    }
}

describe('web runtime events', () => {
    beforeEach(() => {
        vi.resetModules()
        FakeEventSource.instances = []
        window.go = undefined
        vi.stubGlobal('EventSource', FakeEventSource)
    })

    it('attaches a new event exactly once when creating EventSource', async () => {
        const {EventsOn} = await import('./runtime')
        const callback = vi.fn()
        const unsubscribe = EventsOn('app:log', callback)
        const source = FakeEventSource.instances[0]

        expect(source).toBeDefined()
        expect(source.listenerCount('app:log')).toBe(1)
        source.emit('app:log', '"line one"')
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith('line one')

        unsubscribe()
        expect(source.readyState).toBe(FakeEventSource.CLOSED)
    })

    it('removes an idle event handler before resubscribing while another event stays active', async () => {
        const {EventsOn} = await import('./runtime')
        const oldA = vi.fn()
        const nextA = vi.fn()
        const callbackB = vi.fn()
        const unsubscribeA = EventsOn('event:a', oldA)
        const unsubscribeB = EventsOn('event:b', callbackB)
        const source = FakeEventSource.instances[0]

        unsubscribeA()
        expect(source.readyState).toBe(FakeEventSource.OPEN)
        const unsubscribeNextA = EventsOn('event:a', nextA)
        expect(FakeEventSource.instances).toHaveLength(1)
        expect(source.listenerCount('event:a')).toBe(1)

        source.emit('event:a', '"payload"')
        expect(oldA).not.toHaveBeenCalled()
        expect(nextA).toHaveBeenCalledTimes(1)

        unsubscribeNextA()
        unsubscribeB()
    })
})
