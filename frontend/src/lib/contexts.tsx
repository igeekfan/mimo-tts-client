import {createContext, useContext, useState, ReactNode} from 'react'
import {useSettings} from '../hooks/useSettings'
import {useHistory} from '../hooks/useHistory'
import {useAudioPlayer} from '../hooks/useAudioPlayer'

type SettingsState = ReturnType<typeof useSettings>
type HistoryState = ReturnType<typeof useHistory>
type AudioPlayerState = ReturnType<typeof useAudioPlayer>

type InputState = {
    inputText: string
    setInputText: (text: string | ((prev: string) => string)) => void
}

const SettingsContext = createContext<SettingsState | null>(null)
const HistoryContext = createContext<HistoryState | null>(null)
const AudioPlayerContext = createContext<AudioPlayerState | null>(null)
const InputContext = createContext<InputState | null>(null)

export function SettingsProvider({children}: {children: ReactNode}) {
    const settings = useSettings()
    return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function HistoryProvider({children}: {children: ReactNode}) {
    const history = useHistory()
    return <HistoryContext.Provider value={history}>{children}</HistoryContext.Provider>
}

export function AudioPlayerProvider({children}: {children: ReactNode}) {
    const audioPlayer = useAudioPlayer()
    return <AudioPlayerContext.Provider value={audioPlayer}>{children}</AudioPlayerContext.Provider>
}

export function InputProvider({children}: {children: ReactNode}) {
    const [inputText, setInputText] = useState('')
    return <InputContext.Provider value={{inputText, setInputText}}>{children}</InputContext.Provider>
}

export function useSettingsContext() {
    const ctx = useContext(SettingsContext)
    if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider')
    return ctx
}

export function useHistoryContext() {
    const ctx = useContext(HistoryContext)
    if (!ctx) throw new Error('useHistoryContext must be used within HistoryProvider')
    return ctx
}

export function useAudioPlayerContext() {
    const ctx = useContext(AudioPlayerContext)
    if (!ctx) throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider')
    return ctx
}

export function useInputContext() {
    const ctx = useContext(InputContext)
    if (!ctx) throw new Error('useInputContext must be used within InputProvider')
    return ctx
}
