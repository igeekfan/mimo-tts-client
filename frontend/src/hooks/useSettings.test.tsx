import {act, renderHook, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {useSettings} from './useSettings'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(resolvePromise => {
        resolve = resolvePromise
    })
    return {promise, resolve}
}

const mocks = vi.hoisted(() => ({
    getAboutInfo: vi.fn(),
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    setLang: vi.fn(),
}))

vi.mock('../lib/backend', () => ({
    CheckForUpdate: vi.fn(),
    GetAboutInfo: mocks.getAboutInfo,
    GetSettings: mocks.getSettings,
    OpenReleasePage: vi.fn(),
    SaveSettings: mocks.saveSettings,
}))

vi.mock('../i18n/context', () => ({
    useI18n: () => ({
        t: (key: string) => key,
        lang: 'zh-CN',
        setLang: mocks.setLang,
    }),
}))

describe('useSettings loading', () => {
    beforeEach(() => {
        localStorage.clear()
        mocks.getSettings.mockReset()
        mocks.saveSettings.mockReset()
        mocks.getAboutInfo.mockResolvedValue(null)
        mocks.saveSettings.mockResolvedValue(undefined)
    })

    it('preserves a legitimate empty voice from the backend', async () => {
        mocks.getSettings.mockResolvedValue({
            language: 'zh-CN',
            theme: 'dark',
            apiKey: '',
            baseUrl: 'https://api.xiaomimimo.com/v1',
            model: 'mimo-v2.5-tts-voiceclone',
            voice: '',
            style: '',
            styleHistory: [],
        })

        const {result, unmount} = renderHook(() => useSettings())
        await waitFor(() => expect(result.current.voice).toBe(''))
        unmount()
    })

    it('serializes autosaves so an older write cannot overwrite a newer snapshot', async () => {
        mocks.getSettings.mockResolvedValue({
            language: 'zh-CN',
            theme: 'dark',
            apiKey: '',
            baseUrl: 'https://api.xiaomimimo.com/v1',
            model: 'mimo-v2.5-tts',
            voice: 'initial',
            style: '',
            styleHistory: [],
        })
        const firstSave = deferred<void>()
        mocks.saveSettings.mockImplementationOnce(() => firstSave.promise)
        mocks.saveSettings.mockResolvedValueOnce(undefined)

        const {result, unmount} = renderHook(() => useSettings())
        await waitFor(() => expect(result.current.voice).toBe('initial'))
        act(() => result.current.setVoice('older'))
        await waitFor(() => expect(mocks.saveSettings).toHaveBeenCalledTimes(1), {timeout: 1500})
        expect(mocks.saveSettings.mock.calls[0][0].voice).toBe('older')

        act(() => result.current.setVoice('newer'))
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)) })
        expect(mocks.saveSettings).toHaveBeenCalledTimes(1)

        firstSave.resolve()
        await waitFor(() => expect(mocks.saveSettings).toHaveBeenCalledTimes(2))
        expect(mocks.saveSettings.mock.calls[1][0].voice).toBe('newer')
        unmount()
    })
})
