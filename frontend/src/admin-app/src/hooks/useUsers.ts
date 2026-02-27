/**
 * useUsers Hook - User list management with pagination and search
 *
 * Features:
 * - Fetch users from GET /admin/users with pagination
 * - Search by username or user_id
 * - Loading and error states
 * - Refresh capability
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

/**
 * User interface matching backend API response
 */
export interface User {
  id: string
  user_id: string
  username: string
  email: string
  is_admin: boolean
  is_disabled: boolean
  created_at: string
  updated_at?: string
  last_login?: string
}

/**
 * Pagination state interface
 */
export interface UserListResponse {
  items: User[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

/**
 * Hook options for user list configuration
 */
export interface UseUsersOptions {
  page?: number
  perPage?: number
  search?: string
}

/**
 * Action function return types
 */
export interface ToggleAdminResult {
  success: boolean
  error?: string
}

export interface ToggleActiveResult {
  success: boolean
  error?: string
}

export interface ResetPasswordResult {
  success: boolean
  tempPassword?: string
  error?: string
}

export interface DeleteUserResult {
  success: boolean
  error?: string
}

/**
 * Hook return type
 */
export interface UseUsersReturn {
  users: User[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  actions: {
    toggleAdmin: (userId: string) => Promise<ToggleAdminResult>
    toggleActive: (userId: string) => Promise<ToggleActiveResult>
    resetPassword: (userId: string) => Promise<ResetPasswordResult>
    deleteUser: (userId: string) => Promise<DeleteUserResult>
  }
}

/**
 * Custom hook for user list management
 */
export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const [data, setData] = useState<UserListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(options.page || 1),
        per_page: String(options.perPage || 10),
        ...(options.search && { search: options.search }),
      })
      const response = await api.get<UserListResponse>(`/admin/users?${params}`)
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }, [options.page, options.perPage, options.search])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const nextPage = async () => {
    const currentPage = data?.page || 1
    const totalPages = data?.total_pages || 1
    if (currentPage < totalPages) {
      const newPage = currentPage + 1
      const params = new URLSearchParams({
        page: String(newPage),
        per_page: String(options.perPage || 10),
        ...(options.search && { search: options.search }),
      })
      const response = await api.get<UserListResponse>(`/admin/users?${params}`)
      setData(response)
    }
  }

  const prevPage = async () => {
    const currentPage = data?.page || 1
    if (currentPage > 1) {
      const newPage = currentPage - 1
      const params = new URLSearchParams({
        page: String(newPage),
        per_page: String(options.perPage || 10),
        ...(options.search && { search: options.search }),
      })
      const response = await api.get<UserListResponse>(`/admin/users?${params}`)
      setData(response)
    }
  }

  const goToPage = async (page: number) => {
    const totalPages = data?.total_pages || 1
    if (page >= 1 && page <= totalPages) {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(options.perPage || 10),
        ...(options.search && { search: options.search }),
      })
      const response = await api.get<UserListResponse>(`/admin/users?${params}`)
      setData(response)
    }
  }

  // Action functions for user management operations
  const toggleAdmin = async (userId: string): Promise<ToggleAdminResult> => {
    try {
      await api.post(`/admin/users/${userId}/toggle-admin`)
      await fetchUsers() // Refresh list
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle admin status',
      }
    }
  }

  const toggleActive = async (userId: string): Promise<ToggleActiveResult> => {
    try {
      await api.post(`/admin/users/${userId}/toggle-active`)
      await fetchUsers() // Refresh list
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle user status',
      }
    }
  }

  const resetPassword = async (userId: string): Promise<ResetPasswordResult> => {
    try {
      const result = await api.post<{ temp_password: string }>(
        `/admin/users/${userId}/reset-password`
      )
      return { success: true, tempPassword: result.temp_password }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reset password',
      }
    }
  }

  const deleteUser = async (userId: string): Promise<DeleteUserResult> => {
    try {
      await api.delete(`/admin/users/${userId}`)
      await fetchUsers() // Refresh list
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete user',
      }
    }
  }

  return {
    users: data?.items || [],
    pagination: {
      page: data?.page || 1,
      perPage: data?.per_page || 10,
      total: data?.total || 0,
      totalPages: data?.total_pages || 0,
    },
    isLoading,
    error,
    refresh: fetchUsers,
    nextPage,
    prevPage,
    goToPage,
    actions: {
      toggleAdmin,
      toggleActive,
      resetPassword,
      deleteUser,
    },
  }
}
