'use client'

import React, { useState, useEffect } from 'react'
import { modelsApi, type Model } from '@/lib/api-client'

type ModelsDialogType = 'add' | 'edit' | 'delete'

interface ModelsContextType {
  open: ModelsDialogType | null
  setOpen: (str: ModelsDialogType | null) => void
  currentRow: Model | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Model | null>>
  models: Model[]
  isLoading: boolean
  error: string | null
  total: number
  rowSelection: Record<string, boolean>
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  refresh: () => Promise<void>
  updateModel: (id: string, data: Partial<Model>) => Promise<boolean>
  deleteModel: (id: string) => Promise<boolean>
  createModel: (data: Partial<Model>) => Promise<string | null>
  setDefaultModel: (id: string) => Promise<void>
}

const ModelsContext = React.createContext<ModelsContextType | null>(null)

interface ModelsProviderProps {
  children: React.ReactNode
  search: Record<string, unknown>
  navigate: (opts: { search: Record<string, unknown>; replace?: boolean }) => void
}

export function ModelsProvider({ children, search, navigate }: ModelsProviderProps) {
  const [open, setOpen] = useState<ModelsDialogType | null>(null)
  const [currentRow, setCurrentRow] = useState<Model | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await modelsApi.getAll()
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : []
        setModels(data)
        setTotal(data.length)
      } else {
        setError(response.error || 'Failed to fetch models')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models')
    } finally {
      setIsLoading(false)
    }
  }

  const updateModel = async (id: string, data: Partial<Model>): Promise<boolean> => {
    try {
      const response = await modelsApi.update(id, data)
      if (response.success) {
        await refresh()
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating model:', error)
      return false
    }
  }

  const deleteModel = async (id: string): Promise<boolean> => {
    try {
      const response = await modelsApi.delete(id)
      if (response.success) {
        await refresh()
        return true
      }
      return false
    } catch (error) {
      console.error('Error deleting model:', error)
      return false
    }
  }

  const createModel = async (data: Partial<Model>): Promise<string | null> => {
    try {
      const response = await modelsApi.create(data as any)
      if (response.success) {
        await refresh()
        return response.data?.id || null
      }
      return null
    } catch (error) {
      console.error('Error creating model:', error)
      return null
    }
  }

  const setDefaultModel = async (id: string): Promise<void> => {
    try {
      await modelsApi.setDefault(id)
      await refresh()
    } catch (error) {
      console.error('Error setting default model:', error)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const contextValue: ModelsContextType = {
    open,
    setOpen,
    currentRow,
    setCurrentRow,
    models,
    isLoading,
    error,
    total,
    rowSelection,
    setRowSelection,
    refresh,
    updateModel,
    deleteModel,
    createModel,
    setDefaultModel,
  }

  return (
    <ModelsContext value={contextValue}>
      {children}
    </ModelsContext>
  )
}

export const useModels = () => {
  const context = React.useContext(ModelsContext)

  if (!context) {
    throw new Error('useModels has to be used within <ModelsProvider>')
  }

  return context
}
