import {useCallback, useEffect} from 'react'
import HistoryPanel from './HistoryPanel'
import {useDownload} from '../hooks/useDownload'
import {useHistoryContext} from '../lib/contexts'
import {useAudioPlayerContext} from '../lib/contexts'
import {getErrorMessage} from '../lib/backend'
import {toast} from 'sonner'

const PAGE_SIZE = 20

interface HistoryPageProps {
    navigate?: (path: string) => void
}

export default function HistoryPage({navigate}: HistoryPageProps) {
    const history = useHistoryContext()
    const audioPlayer = useAudioPlayerContext()
    const {download} = useDownload()

    useEffect(() => {
        void history.loadHistory('', 1)
        return history.cancelHistoryLoad
    }, [history.loadHistory, history.cancelHistoryLoad])

    const handleDeleteTask = useCallback((taskId: string) => {
        void history.deleteTask(taskId, audioPlayer.playingTaskId, audioPlayer.stop)
            .catch(error => toast.error(getErrorMessage(error)))
    }, [history, audioPlayer])

    const handleClearCompleted = useCallback(() => {
        void history.clearCompleted(
            audioPlayer.playingTaskId,
            audioPlayer.stop,
            (id) => history.tasks.find(t => t.id === id)?.status === 'completed' && audioPlayer.playingTaskId === id,
        ).catch(error => toast.error(getErrorMessage(error)))
    }, [history, audioPlayer])

    const handleNavigateToSynthesis = useCallback(() => {
        navigate?.('/')
    }, [navigate])

    return (
        <div className="flex-1 min-h-0 p-4 pt-2">
            <HistoryPanel
                tasks={history.tasks}
                historyTotal={history.historyTotal}
                historyPage={history.historyPage}
                historyPageSize={PAGE_SIZE}
                historySearch={history.historySearch}
                onHistorySearch={history.searchHistory}
                onPageChange={history.changePage}
                expandedTaskId={history.expandedTaskId}
                setExpandedTaskId={history.setExpandedTaskId}
                playingTaskId={audioPlayer.playingTaskId}
                isPlaying={audioPlayer.isPlaying}
                currentTime={audioPlayer.currentTime}
                duration={audioPlayer.duration}
                onPlay={audioPlayer.play}
                onTogglePlay={audioPlayer.togglePlay}
                onStop={audioPlayer.stop}
                onSeek={audioPlayer.seek}
                onDelete={handleDeleteTask}
                onClearCompleted={handleClearCompleted}
                onDownload={download}
                onLoadAudio={history.loadAudio}
                onNavigateToSynthesis={handleNavigateToSynthesis}
            />
        </div>
    )
}
