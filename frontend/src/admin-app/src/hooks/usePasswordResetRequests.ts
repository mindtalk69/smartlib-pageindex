/**
 * usePasswordResetRequests Hook - Password reset request management
 *
 * Features:
 * - Fetch password reset requests from GET /api/v1/admin/password-reset-requests
 * - Support status filter parameter (pending/approved/denied/all)
 * - Approve and deny action functions
 * - Loading and error states
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

/**
 * RequestStatus type for status filtering across all components
 */
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'all'

/**
 * PasswordResetRequest interface matching backend API response
 */
export interface PasswordResetRequest {
  id: string
  user_id: string
  username: string
  email: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  requested_at: string
  reviewed_at?: string
  reviewed_by?: string
  admin_notes?: string
  temp_password?: string
}

/**
 * Hook options for status filtering
 */
export interface UsePasswordResetRequestsOptions {
  status?: RequestStatus
}

/**
 * Action function return types
 */
export interface ApproveResult {
  success: boolean
  tempPassword?: string
  error?: string
}

export interface DenyResult {
  success: boolean
  error?: string
}

/**
 * Hook return type
 */
export interface UsePasswordResetRequestsReturn {
  requests: PasswordResetRequest[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  actions: {
    approve: (requestId: string) => Promise<ApproveResult>
    deny: (requestId: string, notes: string) => Promise<DenyResult>
  }
}

/**
 * Custom hook for password reset request management
 */
export function usePasswordResetRequests(
  options: UsePasswordResetRequestsOptions = {}
): UsePasswordResetRequestsReturn {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (options.status && options.status !== 'all') {
        params.append('status', options.status)
      }
      const response = await api.get<PasswordResetRequest[]>(
        `/api/v1/admin/password-reset-requests?${params}`
      )
      setRequests(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch password reset requests')
    } finally {
      setIsLoading(false)
    }
  }, [options.status])

  const approve = async (requestId: string): Promise<ApproveResult> => {
    try {
      const result = await api.post<{ temp_password: string }>(
        `/api/v1/admin/password-reset-requests/${requestId}/approve`
      )
      await fetchRequests() // Refresh list
      return { success: true, tempPassword: result.temp_password }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to approve request',
      }
    }
  }

  const deny = async (requestId: string, notes: string): Promise<DenyResult> => {
    try {
      await api.post(`/api/v1/admin/password-reset-requests/${requestId}/deny`, { notes })
      await fetchRequests() // Refresh list
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to deny request',
      }
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return {
    requests,
    isLoading,
    error,
    refresh: fetchRequests,
    actions: { approve, deny },
  }
}
