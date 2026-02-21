'use client'

import { createContext, useContext, useState } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { catalogsApi, type Catalog } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type CatalogsDialogType = 'add' | 'edit' | 'delete'

interface CatalogsContextType {
  catalogs: Catalog[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateCatalog: (id: string, data: Partial<Catalog>) => Promise<boolean>
  deleteCatalog: (id: string) => Promise<boolean>
  createCatalog: (data: { name: string; description?: string }) => Promise<string | null>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  open: CatalogsDialogType | null
  setOpen: (type: CatalogsDialogType | null) => void
  currentRow: Catalog | null
  setCurrentRow: (catalog: Catalog | null) => void
}

const CatalogsContext = createContext<CatalogsContextType | undefined>(undefined)

export function CatalogsProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<CatalogsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Catalog | null>(null)

  const {
    items: catalogs,
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
    fetchAll: catalogsApi.getAll,
    fetchById: catalogsApi.getById,
    update: catalogsApi.update,
    delete: catalogsApi.delete,
    create: catalogsApi.create,
    messages: {
      createSuccess: 'Catalog created successfully',
      updateSuccess: 'Catalog updated successfully',
      deleteSuccess: 'Catalog deleted successfully',
      error: 'Operation failed',
    },
  })

  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <CatalogsContext.Provider
      value={{
        catalogs,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateCatalog: updateItem,
        deleteCatalog: deleteItem,
        createCatalog: createItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </CatalogsContext.Provider>
  )
}

export const useCatalogs = () => {
  const context = useContext(CatalogsContext)
  if (!context) {
    throw new Error('useCatalogs must be used within CatalogsProvider')
  }
  return context
}
