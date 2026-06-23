import {useCallback} from 'react'
import {SynthesisTask} from '../types'

export function useDownload() {
    const download = useCallback((task: SynthesisTask) => {
        if (!task.audioBlob) return
        const url = URL.createObjectURL(task.audioBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tts_${task.voice}_${Date.now()}.wav`
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    return {download}
}
