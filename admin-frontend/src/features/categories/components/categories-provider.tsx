'use client'

import { createContext, useContext, useState } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { categoriesApi, type Category } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type CategoriesDialogType = 'add' | 'edit' | 'delete'

interface CategoriesContextType {
  categories: Category[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateCategory: (id: string, data: Partial<Category>) => Promise<boolean>
  deleteCategory: (id: string) => Promise<boolean>
  createCategory: (data: { name: string; description?: string }) => Promise<string | null>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  open: CategoriesDialogType | null
  setOpen: (type: CategoriesDialogType | null) => void
  currentRow: Category | null
  setCurrentRow: (category: Category | null) => void
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined)

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<CategoriesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Category | null>(null)

  const {
    items: categories,
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
    fetchAll: categoriesApi.getAll,
    fetchById: categoriesApi.getById,
    update: categoriesApi.update,
    delete: categoriesApi.delete,
    create: categoriesApi.create,
    messages: {
      createSuccess: 'Category created successfully',
      updateSuccess: 'Category updated successfully',
      deleteSuccess: 'Category deleted successfully',
      error: 'Operation failed',
    },
  })

  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateCategory: updateItem,
        deleteCategory: deleteItem,
        createCategory: createItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export const useCategories = () => {
  const context = useContext(CategoriesContext)
  if (!context) {
    throw new Error('useCategories must be used within CategoriesProvider')
  }
  return context
}
