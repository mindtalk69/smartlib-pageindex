'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { providersApi, type Provider } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type ProvidersDialogType = 'add' | 'edit' | 'delete'

interface ProvidersContextType {
  providers: Provider[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateProvider: (id: string, data: Partial<Provider>) => Promise<boolean>
  deleteProvider: (id: string) => Promise<boolean>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  // Dialog state
  open: ProvidersDialogType | null
  setOpen: (type: ProvidersDialogType | null) => void
  currentRow: Provider | null
  setCurrentRow: (provider: Provider | null) => void
}

const ProvidersContext = createContext<ProvidersContextType | undefined>(
  undefined
)

export function ProvidersProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<ProvidersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Provider | null>(null)

  const {
    items: providers,
    isLoading,
    error,
    total,
    totalPages,
    refresh,
    updateItem,
    deleteItem,
    page,
    perPage,
  } = useAdminCrud({
    fetchAll: providersApi.getAll,
    fetchById: providersApi.getById,
    update: providersApi.update,
    delete: providersApi.delete,
    create: providersApi.create,
    messages: {
      createSuccess: 'Provider created successfully',
      updateSuccess: 'Provider updated successfully',
      deleteSuccess: 'Provider deleted successfully',
      error: 'Operation failed',
    },
  })

  // Sync pagination with page/perPage from hook
  useEffect(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  }, [page, perPage])

  return (
    <ProvidersContext.Provider
      value={{
        providers,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateProvider: updateItem,
        deleteProvider: deleteItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </ProvidersContext.Provider>
  )
}

export const useProviders = () => {
  const context = useContext(ProvidersContext)
  if (!context) {
    throw new Error('useProviders must be used within ProvidersProvider')
  }
  return context
}
