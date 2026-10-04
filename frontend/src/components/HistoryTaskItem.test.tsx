import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import HistoryTaskItem from './HistoryTaskItem'

describe('HistoryTaskItem accessibility', () => {
    it('supports keyboard expansion and names the delete action', () => {
        const onExpand = vi.fn()
        const onDelete = vi.fn()
        render(
            <HistoryTaskItem
                task={{
                    id: 'task-1',
                    text: 'hello',
                    model: 'mimo-v2.5-tts',
                    voice: 'mimo_default',
                    status: 'completed',
                    progress: 100,
                    createdAt: '2026-08-24T00:00:00Z',
                }}
                isExpanded={false}
                isActive={false}
                onExpand={onExpand}
                onCollapse={vi.fn()}
                onDelete={onDelete}
            />,
        )

        fireEvent.keyDown(screen.getByRole('button', {name: 'history.expand'}), {key: 'Enter'})
        expect(onExpand).toHaveBeenCalledWith('task-1')

        fireEvent.click(screen.getByRole('button', {name: 'common.delete'}))
        expect(onDelete).toHaveBeenCalledWith('task-1')
    })
})
