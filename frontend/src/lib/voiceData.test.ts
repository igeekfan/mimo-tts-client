import {describe, expect, it} from 'vitest'
import {getRequestVoice, sanitizeSettingsForPersistence, sanitizeVoiceLabel} from './voiceData'

describe('voice data boundaries', () => {
    it('never allows a data URI into persisted settings', () => {
        const settings = sanitizeSettingsForPersistence({
            language: 'zh-CN',
            theme: 'dark',
            apiKey: '',
            baseUrl: 'https://api.example.test/v1',
            model: 'mimo-v2.5-tts-voiceclone',
            voice: 'data:audio/wav;base64,UklGRg==',
            style: '',
            styleHistory: [],
        })

        expect(settings.voice).toBe('')
        expect(JSON.stringify(settings)).not.toContain('data:audio')
    })

    it('uses a safe file label while clone audio remains a separate request field', () => {
        expect(getRequestVoice('mimo-v2.5-tts-voiceclone', '', 'sample.wav')).toBe('sample.wav')
        expect(sanitizeVoiceLabel('data:audio/mpeg;base64,AAAA', 'voice-clone')).toBe('voice-clone')
    })
})
