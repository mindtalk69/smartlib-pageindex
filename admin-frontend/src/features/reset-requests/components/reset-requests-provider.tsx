'use client'

import React, { useState, useEffect } from 'react'
import { resetRequestsApi, type PasswordResetRequest as ResetRequest } from '@/lib/api-client'

type ResetRequestsDialogType = 'approve' | 'deny'

interface ResetRequestsContextType {
  open: ResetRequestsDialogType | null
  setOpen: (str: ResetRequestsDialogType | null) => void
  currentRow: ResetRequest | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ResetRequest | null>>
  resetRequests: ResetRequest[]
  isLoading: boolean
  error: string | null
  total: number
  rowSelection: Record<string, boolean>
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  statusFilter: string
  setStatusFilter: (status: string) => void
  refresh: () => Promise<void>
}

const ResetRequestsContext = React.createContext<ResetRequestsContextType | null>(null)

interface ResetRequestsProviderProps {
  children: React.ReactNode
  search?: Record<string, unknown>
  navigate?: (opts: { search: Record<string, unknown>; replace?: boolean }) => void
}

export function ResetRequestsProvider({ children, search, navigate }: ResetRequestsProviderProps) {
  const [open, setOpen] = useState<ResetRequestsDialogType | null>(null)
  const [currentRow, setCurrentRow] = useState<ResetRequest | null>(null)
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [statusFilter, setStatusFilter] = useState('pending')

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: { status?: 'pending' | 'completed' | 'denied' } = statusFilter ? { status: statusFilter as any } : {}
      const response = await resetRequestsApi.getAll(params)
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : []
        setResetRequests(data)
        setTotal(data.length)
      } else {
        setError(response.error || 'Failed to fetch reset requests')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reset requests')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: ResetRequestsContextType = {
    open,
    setOpen,
    currentRow,
    setCurrentRow,
    resetRequests,
    isLoading,
    error,
    total,
    rowSelection,
    setRowSelection,
    statusFilter,
    setStatusFilter,
    refresh,
  }

  return (
    <ResetRequestsContext value={contextValue}>
      {children}
    </ResetRequestsContext>
  )
}

export const useResetRequests = () => {
  const context = React.useContext(ResetRequestsContext)

  if (!context) {
    throw new Error('useResetRequests has to be used within <ResetRequestsProvider>')
  }

  return context
}
