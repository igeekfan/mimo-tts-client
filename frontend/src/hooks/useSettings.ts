import {useState, useEffect, useCallback} from 'react'
import {GetSettings, SaveSettings, CheckForUpdate, GetAboutInfo, OpenReleasePage} from '../lib/backend'
import {ModelType, AboutInfo, UpdateInfo} from '../types'
import {useI18n} from '../i18n/context'
import {toast} from 'sonner'

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

    useEffect(() => {
        GetSettings().then(settings => {
            if (settings.theme) setTheme(settings.theme as 'light' | 'dark')
            if (settings.apiKey) setApiKey(settings.apiKey)
            if (settings.baseUrl) setBaseUrl(settings.baseUrl)
            if (settings.model) setModel(settings.model as ModelType)
            if (settings.voice) setVoice(settings.voice)
            if (settings.style !== undefined) setStyle(settings.style)
            if (settings.styleHistory) setStyleHistory(settings.styleHistory)
        }).catch(console.error)

        GetAboutInfo().then(info => setAboutInfo(info)).catch(console.error)
    }, [])

    useEffect(() => {
        const root = document.documentElement
        root.classList.toggle('dark', theme === 'dark')
        root.classList.toggle('light', theme === 'light')
        localStorage.setItem(STORAGE_KEY_THEME, theme)
    }, [theme])

    useEffect(() => {
        const timer = setTimeout(() => {
            SaveSettings({language: lang, theme, apiKey, baseUrl, model, voice, style, styleHistory}).catch(console.error)
        }, 500)
        return () => clearTimeout(timer)
    }, [lang, theme, apiKey, baseUrl, model, voice, style, styleHistory])

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
