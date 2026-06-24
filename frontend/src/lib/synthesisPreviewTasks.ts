import {SynthesisTask} from '../types'

export function selectSynthesisPreviewTasks(tasks: SynthesisTask[]): SynthesisTask[] {
    return tasks.filter(task => !task.dbId)
}
