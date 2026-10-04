import {HistoryItem, UpdateInfo, AboutInfo, Settings, SynthesisRequest} from '../types'
import {EventsOn} from './runtime'
import {authHeaders, setToken} from './webAuth'
import {sanitizeVoiceLabel} from './voiceData'

const MAX_ERROR_MESSAGE_LENGTH = 1000

type APIErrorDetail = {
  code?: string
  message?: string
}

export class BackendError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'BackendError'
    this.status = status
    this.code = code
  }
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`
}

function parseErrorDetail(value: unknown): APIErrorDetail | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const nested = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : record
  return {
    code: typeof nested.code === 'string' ? nested.code : undefined,
    message: typeof nested.message === 'string' ? nested.message : undefined,
  }
}

async function createResponseError(res: Response): Promise<BackendError> {
  const body = await res.text()
  let detail: APIErrorDetail | null = null
  if (body) {
    try {
      detail = parseErrorDetail(JSON.parse(body))
    } catch {
    }
  }
  const message = truncateMessage(detail?.message || body || res.statusText || `HTTP ${res.status}`)
  return new BackendError(message, res.status, detail?.code || `HTTP_${res.status}`)
}

function createSseError(data: string, status: number): BackendError {
  let detail: APIErrorDetail | null = null
  try {
    detail = parseErrorDetail(JSON.parse(data))
  } catch {
  }
  return new BackendError(
    truncateMessage(detail?.message || data || 'SSE stream failed'),
    status,
    detail?.code || 'SSE_ERROR',
  )
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// webFetch wraps fetch for web mode: it attaches the Authorization header when
// a token is stored and clears the token on 401 so a reload re-prompts.
async function webFetch(input: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    const headers = new Headers(init?.headers)
    const mergedHeaders = authHeaders(Object.fromEntries(headers.entries()))
    res = await fetch(input, {...init, headers: mergedHeaders})
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new BackendError(getErrorMessage(error), 0, 'NETWORK_ERROR')
  }
  if (res.status === 401) {
    setToken(null)
  }
  if (!res.ok) throw await createResponseError(res)
  return res
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return await res.json() as T
  } catch {
    throw new BackendError('Backend returned invalid JSON', res.status, 'INVALID_JSON')
  }
}

declare global {
  interface Window {
    go?: {
      desktop?: {
        App: {
          GetSettings(): Promise<Settings>
          SaveSettings(settings: Settings): Promise<void>
          SetLang(lang: string): Promise<void>
          GetLang(): Promise<string>
           GetAboutInfo(): Promise<AboutInfo>
           GetCurrentVersion(): Promise<string>
           CheckForUpdate(): Promise<UpdateInfo>
           OpenReleasePage(): Promise<void>
           SelectFolder(): Promise<string>
          OpenFolder(path: string): Promise<void>
          OpenFile(path: string): Promise<void>
          SynthesizeSpeech(req: {
            requestId: string
            text: string
            model: string
            voice: string
            cloneAudioData: string
            style: string
            optimizeTextPreview: boolean
          }): Promise<{audioData: string; format: string; error: string}>
          CancelSynthesis(requestId: string): Promise<void>
          StartSynthesizeSpeechStream(req: {
            streamId: string
            text: string
            model: string
            voice: string
            cloneAudioData: string
            style: string
            optimizeTextPreview: boolean
          }): Promise<void>
          CancelStream(streamId: string): Promise<void>
          GetHistory(): Promise<HistoryItem[]>
          SearchHistory(query: string, offset: number, limit: number): Promise<{items: HistoryItem[]; total: number; offset: number; limit: number}>
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

function validatePCM16Chunk(bytes: Uint8Array, status: number, codePrefix: string): Uint8Array {
  if (bytes.length === 0 || bytes.length % 2 !== 0) {
    throw new BackendError('Backend returned invalid PCM16 audio', status, `${codePrefix}_INVALID_AUDIO`)
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
  request: SynthesisRequest,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array, void, unknown> {
  const desktop = getDesktop()
  if (!desktop) {
    throw new Error('Desktop backend unavailable')
  }

  const streamId = nextStreamId()
  const eventName = `tts:stream:${streamId}`
  const queue: Uint8Array[] = []
  let done = false
  let sawAudio = false
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
      try {
        const chunk = validatePCM16Chunk(decodeBase64ToBytes(payload.data), 0, 'DESKTOP_STREAM')
        sawAudio = true
        queue.push(chunk)
        flushWaiter()
      } catch (error) {
        streamError = error instanceof Error ? error : new Error(String(error))
        done = true
        flushWaiter()
      }
    }

    if (payload?.done) {
      done = true
      flushWaiter()
    }
  })

  const onAbort = () => {
    void desktop.CancelStream?.(streamId)
  }

  try {
    await desktop.StartSynthesizeSpeechStream({
      streamId,
      text: request.text,
      model: request.model,
      voice: sanitizeVoiceLabel(request.voice),
      cloneAudioData: request.cloneAudioData || '',
      style: request.style,
      optimizeTextPreview: request.optimizeTextPreview || false,
    })

    // Once the stream is registered on the backend, wire cancellation.
    if (signal) {
      if (signal.aborted) {
        onAbort()
      } else {
        signal.addEventListener('abort', onAbort)
      }
    }

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
    if (!sawAudio) {
      throw new BackendError('Desktop stream ended without audio', 0, 'DESKTOP_STREAM_NO_AUDIO')
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
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
  request: SynthesisRequest,
  signal?: AbortSignal,
): Promise<{audioData: string; format: string; error: string}> {
  const desktop = getDesktop()
  if (desktop) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return await desktop.SynthesizeSpeech({
      requestId: request.requestId,
      text: request.text,
      model: request.model,
      voice: sanitizeVoiceLabel(request.voice),
      cloneAudioData: request.cloneAudioData || '',
      style: request.style,
      optimizeTextPreview: request.optimizeTextPreview || false,
    })
  }
  const res = await webFetch('/api/synthesize', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      text: request.text,
      model: request.model,
      voice: sanitizeVoiceLabel(request.voice),
      cloneAudioData: request.cloneAudioData || '',
      style: request.style,
      optimizeTextPreview: request.optimizeTextPreview || false,
    }),
    signal,
  })
  const data = await readJson<{audioData: string; format: string; error?: string}>(res)
  if (data.error) throw new BackendError(data.error, res.status, 'SYNTHESIS_ERROR')
  return {audioData: data.audioData, format: data.format, error: ''}
}

export async function CancelSynthesis(requestId: string): Promise<void> {
  const desktop = getDesktop()
  if (desktop) await desktop.CancelSynthesis(requestId)
}

export async function GetSettings(): Promise<Settings> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetSettings()
  }
  const res = await webFetch('/api/settings')
  return await readJson<Settings>(res)
}

export async function SaveSettings(settings: Settings): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SaveSettings(settings)
  }
  await webFetch('/api/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(settings),
  })
}

const RELEASE_PAGE_URL = 'https://github.com/igeekfan/mimo-tts-client/releases'

export async function GetAboutInfo(): Promise<AboutInfo> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetAboutInfo()
  }
  const res = await webFetch('/api/about')
  return await readJson<AboutInfo>(res)
}

export async function CheckForUpdate(): Promise<UpdateInfo> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.CheckForUpdate()
  }
  const res = await webFetch('/api/update')
  return await readJson<UpdateInfo>(res)
}

export async function GetCurrentVersion(): Promise<string> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.GetCurrentVersion()
  }
  const res = await webFetch('/api/version')
  const data = await readJson<{version: string}>(res)
  return data.version
}

export async function OpenReleasePage(): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.OpenReleasePage()
  }
  window.open(RELEASE_PAGE_URL, '_blank', 'noopener,noreferrer')
}

export async function* SynthesizeSpeechStream(
  request: SynthesisRequest,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array, void, unknown> {
  const desktop = getDesktop()
  if (desktop) {
    yield* synthesizeSpeechStreamDesktop(request, signal)
    return
  }

  const res = await webFetch('/api/synthesize-stream', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      text: request.text,
      model: request.model,
      voice: sanitizeVoiceLabel(request.voice),
      cloneAudioData: request.cloneAudioData || '',
      style: request.style,
      optimizeTextPreview: request.optimizeTextPreview || false,
    }),
    signal,
  })

  const reader = res.body?.getReader()
  if (!reader) throw new BackendError('Backend returned no stream body', res.status, 'SSE_NO_BODY')

  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false
  let sawAudio = false

  const handleEvent = (rawEvent: string): {kind: 'done'} | {kind: 'chunk'; data: Uint8Array} | null => {
    const parsed = parseSseEvent(rawEvent)
    if (!parsed) return null
    if (parsed.eventName === 'error') throw createSseError(parsed.data, res.status)
    if (parsed.data === '[DONE]') return {kind: 'done'}
    try {
      return {kind: 'chunk', data: validatePCM16Chunk(decodeBase64ToBytes(parsed.data), res.status, 'SSE')}
    } catch {
      throw new BackendError('Backend returned invalid stream audio', res.status, 'SSE_INVALID_DATA')
    }
  }

  try {
    streamLoop: while (true) {
      const {done, value} = await reader.read()
      if (done) break

      buffer += decoder.decode(value, {stream: true})
      const events = buffer.split(/\r?\n\r?\n/)
      buffer = events.pop() || ''

      for (const rawEvent of events) {
        const event = handleEvent(rawEvent)
        if (event?.kind === 'done') {
          sawDone = true
          break streamLoop
        }
        if (event?.kind === 'chunk') {
          sawAudio = true
          yield event.data
        }
      }
    }

    buffer += decoder.decode()
    if (!sawDone && buffer.trim()) {
      const event = handleEvent(buffer)
      if (event?.kind === 'done') {
        sawDone = true
      } else if (event?.kind === 'chunk') {
        sawAudio = true
        yield event.data
      }
    }

    if (!sawDone) {
      throw new BackendError('SSE stream ended before [DONE]', res.status, 'SSE_TRUNCATED')
    }
    if (!sawAudio) {
      throw new BackendError('SSE stream ended without audio', res.status, 'SSE_NO_AUDIO')
    }
  } finally {
    reader.releaseLock()
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
  const res = await webFetch('/api/history')
  return await readJson<HistoryItem[]>(res)
}

export async function SearchHistory(
  query: string,
  offset: number,
  limit: number,
  signal?: AbortSignal,
): Promise<{items: HistoryItem[]; total: number; offset: number; limit: number}> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SearchHistory(query, offset, limit)
  }
  const params = new URLSearchParams({q: query, offset: String(offset), limit: String(limit)})
  const res = await webFetch(`/api/history/search?${params}`, {signal})
  return await readJson<{items: HistoryItem[]; total: number; offset: number; limit: number}>(res)
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
  const safeVoice = sanitizeVoiceLabel(voice, 'voice-clone')

  const desktop = getDesktop()
  if (desktop) {
    return await desktop.SaveHistory({text, model, voice: safeVoice, style, audioData: encodedAudio, format})
  }

  await webFetch('/api/history', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text, model, voice: safeVoice, style, audioData: encodedAudio, format}),
  })
}

export async function GetHistoryAudio(id: number): Promise<Blob> {
  const desktop = getDesktop()
  if (desktop) {
    const result = await desktop.GetHistoryAudio(id)
    return decodeBase64ToBlob(result.audioData, result.format)
  }

  const res = await webFetch(`/api/history/audio?id=${id}`)
  return await res.blob()
}

export async function DeleteHistory(id: number): Promise<void> {
  const desktop = getDesktop()
  if (desktop) {
    return await desktop.DeleteHistory(id)
  }

  await webFetch('/api/history/delete', {
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

  await webFetch('/api/history/clear', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{}',
  })
}
