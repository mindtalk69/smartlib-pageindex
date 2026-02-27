/**
 * useModels Hook - Model configuration management
 *
 * Features:
 * - Fetch models from GET /api/v1/admin/models
 * - CRUD operations: addModel, updateModel, deleteModel
 * - Action functions: setDefault, setMultimodal, validateDeployment
 * - Loading and error state tracking
 * - Provider association support
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: number
  provider_id: number | null
  name: string
  deployment_name: string
  provider: string  // Legacy field
  temperature: number | null
  streaming: boolean
  description: string | null
  is_default: boolean
  is_multimodal?: boolean
  created_by: string | null
  created_at: string
  provider_obj?: {
    id: number
    name: string
    provider_type: string
    is_active: boolean
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  streaming_supported?: boolean
  temperature_valid?: boolean
  connectivity_ok?: boolean
  message?: string
}

/**
 * Hook for model management
 */
export function useModels() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all models from API
   */
  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<{ models?: ModelConfig[] }>('/api/v1/admin/models')
      setModels(response.models || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Add a new model
   */
  const addModel = async (model: Omit<ModelConfig, 'id' | 'created_at' | 'provider_obj'>): Promise<void> => {
    await api.post('/api/v1/admin/models/add', model)
    await fetchModels()
  }

  /**
   * Update an existing model
   */
  const updateModel = async (id: number, updates: Partial<ModelConfig>): Promise<void> => {
    await api.post(`/api/v1/admin/models/edit/${id}`, updates)
    await fetchModels()
  }

  /**
   * Delete a model
   */
  const deleteModel = async (id: number): Promise<void> => {
    await api.post(`/api/v1/admin/models/delete/${id}`)
    await fetchModels()
  }

  /**
   * Set a model as the default
   */
  const setDefault = async (id: number): Promise<void> => {
    await api.post(`/api/v1/admin/models/set-default/${id}`)
  }

  /**
   * Set a model as multimodal
   */
  const setMultimodal = async (id: number): Promise<void> => {
    await api.post(`/api/v1/admin/models/set-multimodal/${id}`)
  }

  /**
   * Validate deployment configuration
   */
  const validateDeployment = async (config: {
    deployment_name: string
    temperature: number | null
    streaming: boolean
    provider_id?: number
  }): Promise<ValidationResult> => {
    return await api.post('/api/v1/admin/models/validate', config)
  }

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return {
    models,
    isLoading,
    error,
    refreshModels: fetchModels,
    addModel,
    updateModel,
    deleteModel,
    setDefault,
    setMultimodal,
    validateDeployment
  }
}
