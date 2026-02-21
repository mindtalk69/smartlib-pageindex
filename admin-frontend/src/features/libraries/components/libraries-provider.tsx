'use client'

import { createContext, useContext, useState } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { librariesApi, type Library } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type LibrariesDialogType = 'add' | 'edit' | 'delete'

interface LibrariesContextType {
  libraries: Library[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateLibrary: (id: string, data: Partial<Library>) => Promise<boolean>
  deleteLibrary: (id: string) => Promise<boolean>
  createLibrary: (data: { name: string; description?: string; knowledge_id?: string }) => Promise<string | null>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  // Dialog state
  open: LibrariesDialogType | null
  setOpen: (type: LibrariesDialogType | null) => void
  currentRow: Library | null
  setCurrentRow: (library: Library | null) => void
}

const LibrariesContext = createContext<LibrariesContextType | undefined>(undefined)

export function LibrariesProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<LibrariesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Library | null>(null)

  const {
    items: libraries,
    isLoading,
    error,
    total,
    totalPages,
    refresh,
    updateItem,
    deleteItem,
    createItem,
    page,
    perPage,
  } = useAdminCrud({
    fetchAll: librariesApi.getAll,
    fetchById: librariesApi.getById,
    update: librariesApi.update,
    delete: librariesApi.delete,
    create: librariesApi.create,
    messages: {
      createSuccess: 'Library created successfully',
      updateSuccess: 'Library updated successfully',
      deleteSuccess: 'Library deleted successfully',
      error: 'Operation failed',
    },
  })

  // Sync pagination with page/perPage from hook
  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <LibrariesContext.Provider
      value={{
        libraries,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateLibrary: updateItem,
        deleteLibrary: deleteItem,
        createLibrary: createItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </LibrariesContext.Provider>
  )
}

export const useLibraries = () => {
  const context = useContext(LibrariesContext)
  if (!context) {
    throw new Error('useLibraries must be used within LibrariesProvider')
  }
  return context
}
