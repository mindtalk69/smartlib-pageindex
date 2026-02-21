import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from '../App'

// Mock fetch
global.fetch = vi.fn()

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
    })

    it('renders the header with SmartLib Chat title', () => {
        render(<App />)
        expect(screen.getByText('SmartLib Chat')).toBeInTheDocument()
    })

    it('shows v2.0 version badge', () => {
        render(<App />)
        expect(screen.getByText('v2.0')).toBeInTheDocument()
    })

    it('shows welcome message when no messages', () => {
        render(<App />)
        expect(screen.getByText('Welcome to SmartLib v2.0')).toBeInTheDocument()
    })

    it('shows development mode notice', () => {
        render(<App />)
        expect(screen.getByText(/Development Mode/)).toBeInTheDocument()
    })

    it('has input textarea for queries', () => {
        render(<App />)
        const input = screen.getByPlaceholderText('Ask about your documents...')
        expect(input).toBeInTheDocument()
    })

    it('disables submit button when input is empty', () => {
        render(<App />)
        const button = screen.getByRole('button', { name: '➤' })
        expect(button).toBeDisabled()
    })

    it('enables submit button when input has text', () => {
        render(<App />)
        const input = screen.getByPlaceholderText('Ask about your documents...')
        fireEvent.change(input, { target: { value: 'test question' } })

        const button = screen.getByRole('button', { name: '➤' })
        expect(button).not.toBeDisabled()
    })

    it('has history toggle button', () => {
        render(<App />)
        expect(screen.getByTitle('Toggle history')).toBeInTheDocument()
    })

    it('persists thread ID to localStorage', () => {
        render(<App />)
        const threadId = localStorage.getItem('smartlib_thread_id')
        expect(threadId).toBeTruthy()
        expect(threadId?.startsWith('thread-')).toBe(true)
    })
})
