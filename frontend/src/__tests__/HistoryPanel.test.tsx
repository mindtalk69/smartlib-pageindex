import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryPanel } from '../components/HistoryPanel'

global.fetch = vi.fn()

describe('HistoryPanel', () => {
    const mockOnSelectThread = vi.fn()
    const mockOnNewThread = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
            ; (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ threads: [] }),
            })
    })

    it('renders history toggle button', () => {
        render(
            <HistoryPanel
                currentThreadId={null}
                onSelectThread={mockOnSelectThread}
                onNewThread={mockOnNewThread}
            />
        )
        expect(screen.getByTitle('Toggle history')).toBeInTheDocument()
    })

    it('shows Chat History header when panel is open', async () => {
        render(
            <HistoryPanel
                currentThreadId={null}
                onSelectThread={mockOnSelectThread}
                onNewThread={mockOnNewThread}
            />
        )

        // Click toggle to open
        fireEvent.click(screen.getByTitle('Toggle history'))
        expect(screen.getByText('Chat History')).toBeInTheDocument()
    })

    it('has new thread button', async () => {
        render(
            <HistoryPanel
                currentThreadId={null}
                onSelectThread={mockOnSelectThread}
                onNewThread={mockOnNewThread}
            />
        )

        fireEvent.click(screen.getByTitle('Toggle history'))
        expect(screen.getByTitle('New conversation')).toBeInTheDocument()
    })

    it('calls onNewThread when new thread button clicked', async () => {
        render(
            <HistoryPanel
                currentThreadId={null}
                onSelectThread={mockOnSelectThread}
                onNewThread={mockOnNewThread}
            />
        )

        fireEvent.click(screen.getByTitle('Toggle history'))
        fireEvent.click(screen.getByTitle('New conversation'))
        expect(mockOnNewThread).toHaveBeenCalled()
    })
})
