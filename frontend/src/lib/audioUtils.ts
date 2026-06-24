import {SynthesisTask} from '../types'

let taskIdCounter = 0

export function createTaskId(): string {
    return `task_${Date.now()}_${++taskIdCounter}`
}

export function isLoadingAudio(task: SynthesisTask | null | undefined): boolean {
    if (!task?.dbId) return false
    // 如果明确标记为无音频，不显示加载中
    if (task.hasAudio === false) return false
    return !task.audioBlob && task.status === 'completed'
}

export function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}

export function addWavHeader(pcmData: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
    const byteRate = sampleRate * channels * bitsPerSample / 8
    const blockAlign = channels * bitsPerSample / 8
    const dataSize = pcmData.length
    const fileSize = 36 + dataSize
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    writeString(view, 0, 'RIFF')
    view.setUint32(4, fileSize, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    const uint8 = new Uint8Array(buffer)
    uint8.set(pcmData, 44)
    return uint8
}
