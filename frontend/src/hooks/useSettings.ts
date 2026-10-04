import {useState, useEffect, useCallback, useRef} from 'react'
import {GetSettings, SaveSettings, CheckForUpdate, GetAboutInfo, OpenReleasePage} from '../lib/backend'
import {ModelType, AboutInfo, UpdateInfo, Settings} from '../types'
import {useI18n} from '../i18n/context'
import {toast} from 'sonner'
import {sanitizeSettingsForPersistence, sanitizeVoiceLabel} from '../lib/voiceData'

const STORAGE_KEY_THEME = 'TTS-theme'

function loadTheme(): 'light' | 'dark' {
    const stored = localStorage.getItem(STORAGE_KEY_THEME)
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
}

export function useSettings() {
    const {t, lang, setLang} = useI18n()
    const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme)
    const [apiKey, setApiKey] = useState('')
    const [baseUrl, setBaseUrl] = useState('https://api.xiaomimimo.com/v1')
    const [model, setModel] = useState<ModelType>('mimo-v2.5-tts')
    const [voice, setVoice] = useState('mimo_default')
    const [style, setStyle] = useState('')
    const [styleHistory, setStyleHistory] = useState<string[]>([])
    const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null)
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [updateLoading, setUpdateLoading] = useState(false)
    const [updateError, setUpdateError] = useState('')
    const [apiSettingsOpen, setApiSettingsOpen] = useState(false)
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

    useEffect(() => {
        let active = true
        GetSettings().then(settings => {
            if (!active) return
            if (settings.language === 'zh-CN' || settings.language === 'en-US') setLang(settings.language)
            if (settings.theme) setTheme(settings.theme as 'light' | 'dark')
            if (settings.apiKey) setApiKey(settings.apiKey)
            if (settings.baseUrl) setBaseUrl(settings.baseUrl)
            if (settings.model) setModel(settings.model as ModelType)
            if (settings.voice !== undefined) setVoice(sanitizeVoiceLabel(settings.voice))
            if (settings.style !== undefined) setStyle(settings.style)
            if (settings.styleHistory) setStyleHistory(settings.styleHistory)
            setSettingsLoaded(true)
        }).catch(console.error)

        GetAboutInfo().then(info => setAboutInfo(info)).catch(console.error)
        return () => { active = false }
    }, [setLang])

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle('dark', theme === 'dark')
        root.classList.toggle('light', theme === 'light')
        localStorage.setItem(STORAGE_KEY_THEME, theme)
    }, [theme])

    useEffect(() => {
        if (!settingsLoaded) return
        const timer = setTimeout(() => {
            const settings: Settings = sanitizeSettingsForPersistence({
                language: lang,
                theme,
                apiKey,
                baseUrl,
                model,
                voice,
                style,
                styleHistory,
            })
            // Serialize writes so a slow older request can never finish after
            // and overwrite a newer settings snapshot.
            saveQueueRef.current = saveQueueRef.current
                .catch(() => undefined)
                .then(() => SaveSettings(settings))
                .catch(error => console.error('Failed to save settings:', error))
        }, 500)
        return () => clearTimeout(timer)
    }, [settingsLoaded, lang, theme, apiKey, baseUrl, model, voice, style, styleHistory])

    const checkUpdate = useCallback(async () => {
        setUpdateLoading(true)
        setUpdateError('')
        try {
            const info = await CheckForUpdate()
            setUpdateInfo(info)
        } catch (err: any) {
            setUpdateError(err.message)
        } finally {
            setUpdateLoading(false)
        }
    }, [])

    const openReleasePage = useCallback(async () => {
        try {
            await OpenReleasePage()
        } catch (err: any) {
            toast.error(err.message)
        }
    }, [])

    const saveStyleToHistory = useCallback((newStyle: string) => {
        if (!newStyle.trim()) return
        setStyleHistory(prev => {
            const filtered = prev.filter(s => s !== newStyle)
            return [newStyle, ...filtered].slice(0, 20)
        })
    }, [])

    const deleteStyleFromHistory = useCallback((styleToDelete: string) => {
        setStyleHistory(prev => prev.filter(s => s !== styleToDelete))
    }, [])

    return {
        theme, setTheme,
        lang, setLang,
        apiKey, setApiKey,
        baseUrl, setBaseUrl,
        model, setModel,
        voice, setVoice,
        style, setStyle,
        styleHistory, setStyleHistory,
        aboutInfo,
        updateInfo, updateLoading, updateError,
        apiSettingsOpen, setApiSettingsOpen,
        checkUpdate,
        openReleasePage,
        saveStyleToHistory,
        deleteStyleFromHistory,
    }
}
