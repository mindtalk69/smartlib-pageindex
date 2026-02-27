/**
 * useProviders Hook - Provider list management with CRUD operations
 *
 * Features:
 * - Fetch providers from GET /api/v1/admin/providers
 * - CRUD operations: add, update, delete
 * - Action operations: testConnection, discoverModels, updatePriorities
 * - Loading and error states
 * - Providers sorted by priority
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

/**
 * LLMProvider interface matching backend API response
 */
export interface LLMProvider {
  id: number
  name: string
  provider_type: string  // 'azure_openai', 'ollama', 'openai', 'anthropic'
  base_url: string | null
  api_key?: string  // Only for send, not received
  is_active: boolean
  is_default: boolean
  priority: number
  config: Record<string, unknown>
  last_health_check: string | null
  health_status: 'healthy' | 'degraded' | 'offline' | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/**
 * Provider list response type
 */
export interface ProviderListResponse {
  providers: LLMProvider[]
}

/**
 * Action function return types
 */
export interface TestConnectionResult {
  success: boolean
  status?: string
  error?: string
  message?: string
}

export interface DiscoverModelsResult {
  success: boolean
  models?: Array<{
    id: string
    name: string
    description?: string
  }>
  error?: string
}

export interface UpdatePrioritiesResult {
  success: boolean
  message?: string
  error?: string
}

export interface AddProviderResult {
  success: boolean
  provider?: LLMProvider
  error?: string
}

export interface UpdateProviderResult {
  success: boolean
  provider?: LLMProvider
  error?: string
}

export interface DeleteProviderResult {
  success: boolean
  error?: string
}

/**
 * Hook return type
 */
export interface UseProvidersReturn {
  providers: LLMProvider[]
  isLoading: boolean
  error: string | null
  refreshProviders: () => Promise<void>
  addProvider: (provider: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>) => Promise<AddProviderResult>
  updateProvider: (id: number, updates: Partial<LLMProvider>) => Promise<UpdateProviderResult>
  deleteProvider: (id: number) => Promise<DeleteProviderResult>
  testConnection: (id: number) => Promise<TestConnectionResult>
  discoverModels: (id: number) => Promise<DiscoverModelsResult>
  updatePriorities: (priorities: Array<{ id: number; priority: number }>) => Promise<UpdatePrioritiesResult>
}

/**
 * Custom hook for provider management
 */
export function useProviders(): UseProvidersReturn {
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.get<ProviderListResponse>('/api/v1/admin/providers')
      // Sort by priority (ascending - lower number = higher priority)
      const sorted = (data.providers || []).sort((a, b) => a.priority - b.priority)
      setProviders(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addProvider = async (
    provider: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AddProviderResult> => {
    try {
      const result = await api.post<{ success: boolean; provider: LLMProvider }>(
        '/api/v1/admin/providers',
        provider
      )
      await fetchProviders()
      return { success: true, provider: result.provider }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to add provider',
      }
    }
  }

  const updateProvider = async (
    id: number,
    updates: Partial<LLMProvider>
  ): Promise<UpdateProviderResult> => {
    try {
      const result = await api.put<{ success: boolean; provider: LLMProvider }>(
        `/api/v1/admin/providers/${id}`,
        updates
      )
      await fetchProviders()
      return { success: true, provider: result.provider }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update provider',
      }
    }
  }

  const deleteProvider = async (id: number): Promise<DeleteProviderResult> => {
    try {
      await api.delete(`/api/v1/admin/providers/${id}`)
      await fetchProviders()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete provider',
      }
    }
  }

  const testConnection = async (id: number): Promise<TestConnectionResult> => {
    try {
      const result = await api.post<TestConnectionResult>(
        `/api/v1/admin/providers/${id}/test`
      )
      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test connection',
      }
    }
  }

  const discoverModels = async (id: number): Promise<DiscoverModelsResult> => {
    try {
      const result = await api.post<DiscoverModelsResult>(
        `/api/v1/admin/providers/${id}/discover-models`
      )
      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to discover models',
      }
    }
  }

  const updatePriorities = async (
    priorities: Array<{ id: number; priority: number }>
  ): Promise<UpdatePrioritiesResult> => {
    try {
      const result = await api.post<UpdatePrioritiesResult>(
        '/api/v1/admin/providers/priority',
        { priorities }
      )
      await fetchProviders()
      return result
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update priorities',
      }
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  return {
    providers,
    isLoading,
    error,
    refreshProviders: fetchProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    testConnection,
    discoverModels,
    updatePriorities,
  }
}
