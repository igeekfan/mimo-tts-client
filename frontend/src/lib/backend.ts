import {SynthesisTask, ModelType, HistoryItem} from '../types'
import {EventsOn} from './runtime'

declare global {
  interface Window {
    go?: {
      desktop?: {
        App: {
          GetSettings(): Promise<{language: string; theme: string; apiKey: string; baseUrl: string; model: string; voice: string; style: string}>
          SaveSettings(settings: {language: string; theme: string; apiKey: string; baseUrl: string; model: string; voice: string; style: string}): Promise<void>
          SetLang(lang: string): Promise<void>
          GetLang(): Promise<string>
          GetAboutInfo(): Promise<{appVersion: string; systemVersion: string; authorEmail: string}>
          GetCurrentVersion(): Promise<string>
          SelectFolder(): Promise<string>
          OpenFolder(path: string): Promise<void>
          OpenFile(path: string): Promise<void>
          SynthesizeSpeech(req: {
            text: string
            model: string
            voice: string
            style: string
            outputDir: string
          }): Promise<{audioData: string; format: string; error: string}>
          StartSynthesizeSpeechStream(req: {
            streamId: string
            text: string
            model: string
            voice: string
            style: string
          }): Promise<void>
          GetHistory(): Promise<HistoryItem[]>
          SaveHistory(req: {
            text: string
            model: string
            voice: string
            style: string
            audioData: string
            format: string
          }): Promise<void>
          GetHistoryAudio(id: number): Promise<{audioData: string; format: string}>
          DeleteHistory(id: number): Promise<void>
          ClearHistory(): Promise<void>
        }
      }
    }
  }
}

type DesktopStreamEvent = {
  data?: string
  error?: string
  done?: boolean
}

export type BackendMode = 'desktop' | 'web'

export function getDesktop() {
  if (window.go?.desktop?.App) {
    return window.go.desktop.App
  }
  return null
}

export const backendMode: BackendMode = getDesktop() ? 'desktop' : 'web'

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function encodeBytesToBase64(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const chunkSize = 0x8000
  let binary = ''

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}

function getAudioMimeType(format: string): string {
  if (format === 'wav') {
    return 'audio/wav'
  }
  return 'application/octet-stream'
}

function decodeBase64ToBlob(base64: string, format: string): Blob {
  const bytes = decodeBase64ToBytes(base64)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], {type: getAudioMimeType(format)})
}

function nextStreamId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function* synthesizeSpeechStreamDesktop(
  text: string,
  model: ModelType,
  voice: string,
  style: string,
): AsyncGenerator<Uint8Array, void, unknown> {
  const desktop = getDesktop()
  if (!desktop) {
    throw new Error('Desktop backend unavailable')
  }

  const streamId = nextStreamId()
  const eventName = `tts:stream:${streamId}`
  const queue: Uint8Array[] = []
  let done = false
  let streamError: Error | null = null
  let waiter: {
    resolve: (result: IteratorResult<Uint8Array, void>) => void
    reject: (reason?: unknown) => void
  } | null = null

  const flushWaiter = () => {
    if (!waiter) {
      return
    }

    if (queue.length > 0) {
      const nextChunk = queue.shift()!
      const currentWaiter = waiter
      waiter = null
      currentWaiter.resolve({value: nextChunk, done: false})
      return
    }

    if (streamError) {
      const currentWaiter = waiter
      waiter = null
      currentWaiter.reject(streamError)
      return
    }

    if (done) {
      const currentWaiter = waiter
      waiter = null
      currentWaiter.resolve({value: undefined, done: true})
    }
  }

  const waitForChunk = () => new Promise<IteratorResult<Uint8Array, void>>((resolve, reject) => {
    waiter = {resolve, reject}
    flushWaiter()
  })

  const unsubscribe = EventsOn(eventName, (payload: DesktopStreamEvent) => {
    if (payload?.error) {
      streamError = new Error(payload.error)
      done = true
      flushWaiter()
      return
    }

    if (payload?.data) {
      queue.push(decodeBase64ToBytes(payload.data))
      flushWaiter()
    }

    if (payload?.done) {
      done = true
      flushWaiter()
    }
  })

  try {
    await desktop.StartSynthesizeSpeechStream({streamId, text, model, voice, style})

    while (true) {
      const nextChunk = queue.length > 0
        ? {value: queue.shift()!, done: false as const}
        : await waitForChunk()

      if (nextChunk.done) {
        break
      }

      yield nextChunk.value
    }

    if (streamError) {
      throw streamError
    }
  } finally {
    unsubscribe()
  }
}

function parseSseEvent(rawEvent: string): {eventName: string; data: string} | null {
  const lines = rawEvent.split(/\r?\n/)
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  const data = dataLines.join('\n')
  if (!data) {
    return null
  }

  return {eventName, data}
}

export async function SynthesizeSpeech(
  text: string,
  model: ModelType,
  voice: string,
  style: string,
): Promise<{audioData: string; format: string; error: string}> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SynthesizeSpeech({text, model, voice, style, outputDir: ''})
  }
  const res = await fetch('/api/synthesize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, model, voice, style}),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(data.error)
  }
  return {audioData: data.audioData, format: data.format, error: ''}
}

export async function GetSettings(): Promise<{language: string; theme: string; apiKey: string; baseUrl: string; model: string; voice: string; style: string}> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetSettings()
  }
  const res = await fetch('/api/settings')
  return await res.json()
}

export async function SaveSettings(settings: {language: string; theme: string; apiKey: string; baseUrl: string; model: string; voice: string; style: string}): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SaveSettings(settings)
  }
  await fetch('/api/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(settings),
  })
}

export async function GetAboutInfo(): Promise<{appVersion: string; systemVersion: string; authorEmail: string}> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetAboutInfo()
  }
  const res = await fetch('/api/about')
  return await res.json()
}

export async function* SynthesizeSpeechStream(
  text: string,
  model: ModelType,
  voice: string,
  style: string,
): AsyncGenerator<Uint8Array, void, unknown> {
  const desktop = getDesktop()
  if (desktop) {
    yield* synthesizeSpeechStreamDesktop(text, model, voice, style)
    return
  }

  const res = await fetch('/api/synthesize-stream', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, model, voice, style}),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No reader')

  const decoder = new TextDecoder()
  let buffer = ''

  const handleEvent = (rawEvent: string) => {
    const parsed = parseSseEvent(rawEvent)
    if (!parsed) {
      return null
    }
    if (parsed.eventName === 'error') {
      throw new Error(parsed.data)
    }
    if (parsed.data === '[DONE]') {
      return 'done'
    }
    return decodeBase64ToBytes(parsed.data)
  }

  while (true) {
    const {done, value} = await reader.read()
    if (done) break

    buffer += decoder.decode(value, {stream: true})
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''

    for (const rawEvent of events) {
      const chunk = handleEvent(rawEvent)
      if (chunk === 'done') {
        return
      }
      if (chunk) {
        yield chunk
      }
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    const chunk = handleEvent(buffer)
    if (chunk && chunk !== 'done') {
      yield chunk
    }
  }
}

export async function SelectFolder(): Promise<string> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SelectFolder()
  }
  return ''
}

export async function OpenFolder(path: string): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.OpenFolder(path)
  }
}

export async function GetHistory(): Promise<HistoryItem[]> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetHistory()
  }
  const res = await fetch('/api/history')
  return await res.json()
}

export async function SaveToHistory(
  text: string,
  model: string,
  voice: string,
  style: string,
  audioData: string | Uint8Array | ArrayBuffer,
  format: string,
): Promise<void> {
  const encodedAudio = typeof audioData === 'string' ? audioData : encodeBytesToBase64(audioData)

  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SaveHistory({text, model, voice, style, audioData: encodedAudio, format})
  }

  await fetch('/api/history', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, model, voice, style, audioData: encodedAudio, format}),
  })
}

export async function GetHistoryAudio(id: number): Promise<Blob> {
  const desktop = getDesktop()
  if (desktop) {
    const result = await desktop.GetHistoryAudio(id)
    return decodeBase64ToBlob(result.audioData, result.format)
  }

  const res = await fetch(`/api/history/audio?id=${id}`)
  return await res.blob()
}

export async function DeleteHistory(id: number): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.DeleteHistory(id)
  }

  await fetch('/api/history/delete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id}),
  })
}

export async function ClearHistory(): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.ClearHistory()
  }

  await fetch('/api/history/clear', {method: 'POST'})
}
