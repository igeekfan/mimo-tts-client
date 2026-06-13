export type ModelType = 'mimo-v2.5-tts' | 'mimo-v2.5-tts-voicedesign' | 'mimo-v2.5-tts-voiceclone'

export type AudioFormat = 'wav' | 'pcm16'

export interface TTSRequest {
  text: string
  model: ModelType
  voice: string
  style?: string
  audioFormat: AudioFormat
  stream: boolean
}

export interface TTSResponse {
  audioData: number[]
  format: AudioFormat
  error?: string
}

export interface VoicePreset {
  name: string
  voiceId: string
  language: string
  gender: string
}

export interface Settings {
  language: string
  theme: string
  apiKey: string
  baseUrl: string
  model: ModelType
  voice: string
  style: string
  styleHistory: string[]
}

export interface AboutInfo {
  appVersion: string
  systemVersion: string
  githubRepo: string
  githubUrl: string
  authorEmail: string
}

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseBody: string
  htmlUrl: string
  publishedAt: string
}

export interface SynthesisTask {
  id: string
  text: string
  model: ModelType
  voice: string
  style?: string
  status: 'pending' | 'synthesizing' | 'completed' | 'error'
  progress: number
  audioBlob?: Blob
  error?: string
  createdAt: string
  dbId?: number
}

export interface HistoryItem {
  id: number
  text: string
  model: string
  voice: string
  style: string
  hasAudio: boolean
  format: string
  createdAt: string
}
