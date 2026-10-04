import {beforeEach, describe, expect, it, vi} from 'vitest'
import {GetSettings, SynthesizeSpeech, SynthesizeSpeechStream} from './backend'
import {SynthesisRequest} from '../types'

const request: SynthesisRequest = {
    requestId: 'request-1',
    text: 'hello',
    model: 'mimo-v2.5-tts',
    voice: 'mimo_default',
    style: '',
}

async function consumeStream(response: Response): Promise<Uint8Array[]> {
    vi.mocked(fetch).mockResolvedValueOnce(response)
    const chunks: Uint8Array[] = []
    for await (const chunk of SynthesizeSpeechStream(request)) chunks.push(chunk)
    return chunks
}

describe('web backend contract', () => {
    beforeEach(() => {
        window.go = undefined
        sessionStorage.clear()
        vi.stubGlobal('fetch', vi.fn())
    })

    it('throws structured errors for every non-2xx response', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
            error: {code: 'INVALID_SETTINGS', message: 'settings rejected'},
        }), {
            status: 422,
            headers: {'Content-Type': 'application/json'},
        }))

        await expect(GetSettings()).rejects.toMatchObject({
            status: 422,
            code: 'INVALID_SETTINGS',
            message: 'settings rejected',
        })
    })

    it('keeps desktop-only requestId out of the web synthesis body', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
            audioData: 'AAE=',
            format: 'wav',
            error: '',
        }), {status: 200, headers: {'Content-Type': 'application/json'}}))

        await SynthesizeSpeech(request)
        const [, init] = vi.mocked(fetch).mock.calls[0]
        const body = JSON.parse(String(init?.body))
        expect(body).toEqual({
            text: 'hello',
            model: 'mimo-v2.5-tts',
            voice: 'mimo_default',
            cloneAudioData: '',
            style: '',
            optimizeTextPreview: false,
        })
        expect(body).not.toHaveProperty('requestId')
    })

    it('rejects an SSE response that ends without [DONE]', async () => {
        const response = new Response('data: AAE=\n\n', {
            status: 200,
            headers: {'Content-Type': 'text/event-stream'},
        })

        await expect(consumeStream(response)).rejects.toMatchObject({
            status: 200,
            code: 'SSE_TRUNCATED',
        })
    })

    it('requires non-empty even-length PCM16 audio before [DONE]', async () => {
        await expect(consumeStream(new Response('data: [DONE]\n\n', {
            status: 200,
            headers: {'Content-Type': 'text/event-stream'},
        }))).rejects.toMatchObject({code: 'SSE_NO_AUDIO'})

        await expect(consumeStream(new Response('data: AA==\n\ndata: [DONE]\n\n', {
            status: 200,
            headers: {'Content-Type': 'text/event-stream'},
        }))).rejects.toMatchObject({code: 'SSE_INVALID_AUDIO'})
    })

    it('accepts a complete stream with valid PCM16 audio', async () => {
        const chunks = await consumeStream(new Response('data: AAE=\n\ndata: [DONE]\n\n', {
            status: 200,
            headers: {'Content-Type': 'text/event-stream'},
        }))
        expect(chunks).toHaveLength(1)
        expect([...chunks[0]]).toEqual([0, 1])
    })

    it('parses structured SSE error events without requiring [DONE]', async () => {
        const response = new Response(
            'event: error\ndata: {"error":{"code":"UPSTREAM_FAILED","message":"provider unavailable"}}\n\n',
            {status: 200, headers: {'Content-Type': 'text/event-stream'}},
        )

        await expect(consumeStream(response)).rejects.toMatchObject({
            code: 'UPSTREAM_FAILED',
            message: 'provider unavailable',
        })
    })
})
