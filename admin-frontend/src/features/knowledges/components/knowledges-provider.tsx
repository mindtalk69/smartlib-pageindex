'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { knowledgesApi, categoriesApi, catalogsApi, librariesApi, groupsApi, type Knowledge, type Category, type Catalog, type Library, type Group } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type KnowledgesDialogType = 'add' | 'edit' | 'delete'

interface KnowledgesContextType {
  knowledges: Knowledge[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateKnowledge: (id: number, data: Partial<Knowledge>) => Promise<boolean>
  deleteKnowledge: (id: number) => Promise<boolean>
  createKnowledge: (data: {
    name: string
    description?: string
    category_ids?: string[]
    catalog_ids?: string[]
    library_ids?: string[]
    group_ids?: string[]
  }) => Promise<string | null>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  // Related data for form
  categories: Category[]
  catalogs: Catalog[]
  libraries: Library[]
  groups: Group[]
  refreshRelatedData: () => Promise<void>
  // Dialog state
  open: KnowledgesDialogType | null
  setOpen: (type: KnowledgesDialogType | null) => void
  currentRow: Knowledge | null
  setCurrentRow: (knowledge: Knowledge | null) => void
}

const KnowledgesContext = createContext<KnowledgesContextType | undefined>(undefined)

export function KnowledgesProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<KnowledgesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Knowledge | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [groups, setGroups] = useState<Group[]>([])

  const {
    items: knowledges,
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
    fetchAll: knowledgesApi.getAll,
    fetchById: knowledgesApi.getById,
    update: knowledgesApi.update,
    delete: knowledgesApi.delete,
    create: knowledgesApi.create,
    messages: {
      createSuccess: 'Knowledge created successfully',
      updateSuccess: 'Knowledge updated successfully',
      deleteSuccess: 'Knowledge deleted successfully',
      error: 'Operation failed',
    },
  })

  const refreshRelatedData = async () => {
    try {
      const [catsRes, catsRes2, libsRes, groupsRes] = await Promise.all([
        categoriesApi.getAll({ page: 1, per_page: 100 }),
        catalogsApi.getAll({ page: 1, per_page: 100 }),
        librariesApi.getAll({ page: 1, per_page: 100 }),
        groupsApi.getAll({ page: 1, per_page: 100 }),
      ])
      if (catsRes.success && catsRes.data) setCategories(catsRes.data)
      if (catsRes2.success && catsRes2.data) setCatalogs(catsRes2.data)
      if (libsRes.success && libsRes.data) setLibraries(libsRes.data)
      if (groupsRes.success && groupsRes.data) setGroups(groupsRes.data)
    } catch (err) {
      console.error('Failed to fetch related data:', err)
    }
  }

  useEffect(() => {
    refreshRelatedData()
  }, [])

  // Sync pagination with page/perPage from hook
  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <KnowledgesContext.Provider
      value={{
        knowledges,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateKnowledge: updateItem,
        deleteKnowledge: deleteItem,
        createKnowledge: createItem,
        pagination,
        setPagination,
        categories,
        catalogs,
        libraries,
        groups,
        refreshRelatedData,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </KnowledgesContext.Provider>
  )
}

export const useKnowledges = () => {
  const context = useContext(KnowledgesContext)
  if (!context) {
    throw new Error('useKnowledges must be used within KnowledgesProvider')
  }
  return context
}
