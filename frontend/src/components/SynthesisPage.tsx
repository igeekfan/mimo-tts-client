import {useState, useRef, useCallback, useEffect, useMemo} from 'react'
import TextInput from './TextInput'
import SynthesisSettings from './SynthesisSettings'
import SynthesisPreview from './SynthesisPreview'
import {useSynthesis} from '../hooks/useSynthesis'
import {useSettingsContext} from '../lib/contexts'
import {useHistoryContext} from '../lib/contexts'
import {useAudioPlayerContext} from '../lib/contexts'
import {useInputContext} from '../lib/contexts'
import {useDownload} from '../hooks/useDownload'
import {selectSynthesisPreviewTasks} from '../lib/synthesisPreviewTasks'
import {getRequestVoice} from '../lib/voiceData'
import {useI18n} from '../i18n/context'

export default function SynthesisPage() {
    const {t} = useI18n()
    const {inputText, setInputText} = useInputContext()
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [directorMode, setDirectorMode] = useState(false)
    const [directorRole, setDirectorRole] = useState('')
    const [directorScene, setDirectorScene] = useState('')
    const [directorDirection, setDirectorDirection] = useState('')
    const [optimizeTextPreview, setOptimizeTextPreview] = useState(true)
    const [cloneFileName, setCloneFileName] = useState('')
    const [cloneAudioData, setCloneAudioData] = useState('')

    const settings = useSettingsContext()
    const history = useHistoryContext()
    const audioPlayer = useAudioPlayerContext()
    const {download} = useDownload()
    const previewTasks = useMemo(() => selectSynthesisPreviewTasks(history.tasks), [history.tasks])

    const synthesis = useSynthesis(
        history.addTask,
        history.updateTask,
        history.incrementTotal,
        audioPlayer.play,
    )

    useEffect(() => () => audioPlayer.stop(), [audioPlayer.stop])

    const buildStyleContent = useCallback(() => {
        if (directorMode) {
            const parts = []
            if (directorRole) parts.push(`${t('style.director.role')}：${directorRole}`)
            if (directorScene) parts.push(`${t('style.director.scene')}：${directorScene}`)
            if (directorDirection) parts.push(`${t('style.director.direction')}：${directorDirection}`)
            return parts.join('\n\n')
        }
        return settings.style
    }, [directorMode, directorRole, directorScene, directorDirection, settings.style, t])

    const buildSynthesisInput = useCallback(() => {
        const currentStyle = buildStyleContent()
        return {
            text: inputText,
            model: settings.model,
            voice: getRequestVoice(settings.model, settings.voice, cloneFileName),
            cloneAudioData: settings.model === 'mimo-v2.5-tts-voiceclone' ? cloneAudioData : undefined,
            style: currentStyle,
            optimizeTextPreview: settings.model === 'mimo-v2.5-tts-voicedesign' ? optimizeTextPreview : undefined,
        }
    }, [buildStyleContent, cloneAudioData, cloneFileName, inputText, optimizeTextPreview, settings.model, settings.voice])

    const handleSynthesize = useCallback(() => {
        void synthesis.synthesize(buildSynthesisInput())
    }, [buildSynthesisInput, synthesis.synthesize])

    const handleSynthesizeStream = useCallback(() => {
        void synthesis.synthesizeStream(buildSynthesisInput())
    }, [buildSynthesisInput, synthesis.synthesizeStream])

    const canSynthesize = settings.model !== 'mimo-v2.5-tts-voiceclone' || Boolean(cloneAudioData)

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* 主内容区 - 左右双列 */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_300px]">
                {/* 左列: 文本输入 + 合成预览 */}
                <div className="flex flex-col min-h-0 border-r overflow-hidden">
                    {/* 文本输入 */}
                    <div className="shrink-0 p-4 pb-2">
                        <TextInput
                            inputText={inputText}
                            setInputText={setInputText}
                            textareaRef={textareaRef}
                            onSynthesize={handleSynthesize}
                            onSynthesizeStream={handleSynthesizeStream}
                            onToggleStreamPause={synthesis.toggleStreamPause}
                            onCancelSynthesize={synthesis.cancelSynthesize}
                            onCancelStream={synthesis.cancelStream}
                            isSynthesizing={synthesis.isSynthesizing}
                            isStreaming={synthesis.isStreaming}
                            isStreamPaused={synthesis.isStreamPaused}
                            canSynthesize={canSynthesize}
                        />
                    </div>

                    {/* 合成预览 - 左列底部，自动填满剩余空间 */}
                    <div className="flex-1 min-h-0 p-4 pt-0">
                        <SynthesisPreview
                            tasks={previewTasks}
                            isSynthesizing={synthesis.isSynthesizing}
                            isStreaming={synthesis.isStreaming}
                            playingTaskId={audioPlayer.playingTaskId}
                            isPlaying={audioPlayer.isPlaying}
                            currentTime={audioPlayer.currentTime}
                            duration={audioPlayer.duration}
                            onPlay={audioPlayer.play}
                            onTogglePlay={audioPlayer.togglePlay}
                            onStop={audioPlayer.stop}
                            onSeek={audioPlayer.seek}
                            onDownload={download}
                            onLoadAudio={history.loadAudio}
                        />
                    </div>
                </div>

                {/* 右列: 合成设置 */}
                <div className="flex flex-col min-h-0 overflow-hidden">
                    <SynthesisSettings
                        model={settings.model}
                        setModel={settings.setModel}
                        voice={settings.voice}
                        setVoice={settings.setVoice}
                        cloneFileName={cloneFileName}
                        setCloneFileName={setCloneFileName}
                        cloneAudioData={cloneAudioData}
                        setCloneAudioData={setCloneAudioData}
                        style={settings.style}
                        setStyle={settings.setStyle}
                        directorMode={directorMode}
                        setDirectorMode={setDirectorMode}
                        directorRole={directorRole}
                        setDirectorRole={setDirectorRole}
                        directorScene={directorScene}
                        setDirectorScene={setDirectorScene}
                        directorDirection={directorDirection}
                        setDirectorDirection={setDirectorDirection}
                        optimizeTextPreview={optimizeTextPreview}
                        setOptimizeTextPreview={setOptimizeTextPreview}
                        styleHistory={settings.styleHistory}
                        setStyleHistory={settings.setStyleHistory}
                        saveStyleToHistory={settings.saveStyleToHistory}
                        deleteStyleFromHistory={settings.deleteStyleFromHistory}
                    />
                </div>
            </div>
        </div>
    )
}
