import {ModelType, Settings} from '../types'

const DATA_URI_PATTERN = /^data:/i

export function isDataUri(value: string): boolean {
    return DATA_URI_PATTERN.test(value.trim())
}

export function sanitizeVoiceLabel(value: string, fallback = ''): string {
    if (!value || isDataUri(value)) return fallback
    return value
}

export function getRequestVoice(
    model: ModelType,
    configuredVoice: string,
    cloneFileName: string,
): string {
    if (model === 'mimo-v2.5-tts-voiceclone') {
        return sanitizeVoiceLabel(cloneFileName, 'voice-clone')
    }
    return sanitizeVoiceLabel(configuredVoice)
}

export function sanitizeSettingsForPersistence(settings: Settings): Settings {
    return {
        ...settings,
        voice: sanitizeVoiceLabel(settings.voice),
    }
}
