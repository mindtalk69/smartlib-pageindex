'use client'

import { createContext, useContext, useState } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { filesApi, type File } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type FilesDialogType = 'delete'

interface FilesContextType {
  files: File[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  deleteFile: (id: number) => Promise<boolean>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  // Dialog state
  open: FilesDialogType | null
  setOpen: (type: FilesDialogType | null) => void
  currentRow: File | null
  setCurrentRow: (file: File | null) => void
}

const FilesContext = createContext<FilesContextType | undefined>(undefined)

export function FilesProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<FilesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<File | null>(null)

  const {
    items: files,
    isLoading,
    error,
    total,
    totalPages,
    refresh,
    deleteItem,
    page,
    perPage,
  } = useAdminCrud({
    fetchAll: filesApi.getAll,
    fetchById: filesApi.getById,
    update: filesApi.update,
    delete: filesApi.delete,
    create: filesApi.create,
    messages: {
      deleteSuccess: 'File deleted successfully',
      error: 'Operation failed',
    },
  })

  // Sync pagination with page/perPage from hook
  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <FilesContext.Provider
      value={{
        files,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        deleteFile: deleteItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </FilesContext.Provider>
  )
}

export const useFiles = () => {
  const context = useContext(FilesContext)
  if (!context) {
    throw new Error('useFiles must be used within FilesProvider')
  }
  return context
}
