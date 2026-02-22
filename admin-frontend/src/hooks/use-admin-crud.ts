/**
 * Generic CRUD Hook for Admin Panel
 * Provides reusable CRUD operations for any admin resource
 */

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { ApiResponse, PaginatedResponse } from '@/lib/api-client'

interface UseAdminCrudOptions<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  /** Fetch all items with pagination */
  fetchAll: (params?: { page?: number; per_page?: number; search?: string }) => Promise<ApiResponse<PaginatedResponse<T>>>
  /** Fetch single item by ID */
  fetchById: (id: string) => Promise<ApiResponse<T>>
  /** Create new item */
  create: (data: CreateInput) => Promise<ApiResponse<{ id: string }>>
  /** Update existing item */
  update: (id: string, data: UpdateInput) => Promise<ApiResponse>
  /** Delete item */
  delete: (id: string) => Promise<ApiResponse>
  /** Toast messages */
  messages?: {
    createSuccess?: string
    updateSuccess?: string
    deleteSuccess?: string
    error?: string
  }
}

interface UseAdminCrudReturn<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  // Data state
  items: T[]
  isLoading: boolean
  error: string | null
  // Pagination
  page: number
  perPage: number
  total: number
  totalPages: number
  // Actions
  refresh: () => Promise<void>
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  // CRUD operations
  createItem: (data: CreateInput) => Promise<string | null>
  updateItem: (id: string, data: UpdateInput) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
}

/**
 * Generic CRUD hook for admin resources
 * @example
 * const { items, isLoading, createItem, updateItem, deleteItem, refresh } = useAdminCrud({
 *   fetchAll: usersApi.getAll,
 *   fetchById: usersApi.getById,
 *   create: usersApi.create,
 *   update: usersApi.update,
 *   delete: usersApi.delete,
 *   messages: {
 *     createSuccess: 'User created successfully',
 *     updateSuccess: 'User updated successfully',
 *     deleteSuccess: 'User deleted successfully',
 *   }
 * })
 */
export function useAdminCrud<T extends { id: string }, CreateInput = Partial<T>, UpdateInput = Partial<T>>(
  options: UseAdminCrudOptions<T, CreateInput, UpdateInput>
): UseAdminCrudReturn<T, CreateInput, UpdateInput> {
  const {
    fetchAll,
    fetchById,
    create,
    update,
    delete: deleteApi,
    messages,
  } = options

  // Data state
  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Fetch all items
  const loadItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchAll({ page, per_page: perPage })

      if (response.success && response.data) {
        setItems(response.data.items || [])
        setTotal(response.data.total || 0)
        setTotalPages(response.data.total_pages || 0)
      } else {
        setError(response.error || 'Failed to fetch items')
        setItems([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchAll, page, perPage])

  // Initial load and re-fetch on dependency change
  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Refresh data
  const refresh = useCallback(async () => {
    await loadItems()
  }, [loadItems])

  // Create item
  const createItem = useCallback(async (data: CreateInput): Promise<string | null> => {
    try {
      const response = await create(data)

      if (response.success) {
        toast.success(messages?.createSuccess || 'Item created successfully')
        await refresh()
        return response.data?.id || null
      } else {
        toast.error(response.error || messages?.error || 'Failed to create item')
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error(messages?.error || errorMessage)
      return null
    }
  }, [create, refresh, messages])

  // Update item
  const updateItem = useCallback(async (id: string, data: UpdateInput): Promise<boolean> => {
    try {
      const response = await update(id, data)

      if (response.success) {
        toast.success(messages?.updateSuccess || 'Item updated successfully')
        await refresh()
        return true
      } else {
        toast.error(response.error || messages?.error || 'Failed to update item')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error(messages?.error || errorMessage)
      return false
    }
  }, [update, refresh, messages])

  // Delete item
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await deleteApi(id)

      if (response.success) {
        toast.success(messages?.deleteSuccess || 'Item deleted successfully')
        await refresh()
        return true
      } else {
        toast.error(response.error || messages?.error || 'Failed to delete item')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error(messages?.error || errorMessage)
      return false
    }
  }, [deleteApi, refresh, messages])

  return {
    // Data state
    items,
    isLoading,
    error,
    // Pagination
    page,
    perPage,
    total,
    totalPages,
    // Actions
    refresh,
    setPage,
    setPerPage,
    // CRUD operations
    createItem,
    updateItem,
    deleteItem,
  }
}

export default useAdminCrud
