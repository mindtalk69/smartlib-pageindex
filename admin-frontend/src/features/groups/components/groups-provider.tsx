'use client'

import { createContext, useContext, useState } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { groupsApi, type Group } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type GroupsDialogType = 'add' | 'edit' | 'delete'

interface GroupsContextType {
  groups: Group[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  selectedRows: string[]
  setSelectedRows: (rows: string[]) => void
  refresh: () => Promise<void>
  updateGroup: (id: string, data: Partial<Group>) => Promise<boolean>
  deleteGroup: (id: string) => Promise<boolean>
  createGroup: (data: { name: string; description?: string }) => Promise<string | null>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void
  // Dialog state
  open: GroupsDialogType | null
  setOpen: (type: GroupsDialogType | null) => void
  currentRow: Group | null
  setCurrentRow: (group: Group | null) => void
}

const GroupsContext = createContext<GroupsContextType | undefined>(
  undefined
)

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [open, setOpen] = useDialogState<GroupsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Group | null>(null)

  const {
    items: groups,
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
    fetchAll: groupsApi.getAll,
    fetchById: groupsApi.getById,
    update: groupsApi.update,
    delete: groupsApi.delete,
    create: groupsApi.create,
    messages: {
      createSuccess: 'Group created successfully',
      updateSuccess: 'Group updated successfully',
      deleteSuccess: 'Group deleted successfully',
      error: 'Operation failed',
    },
  })

  // Sync pagination with page/perPage from hook
  useState(() => {
    setPagination({ pageIndex: page - 1, pageSize: perPage })
  })

  return (
    <GroupsContext.Provider
      value={{
        groups,
        isLoading,
        error,
        total,
        totalPages,
        selectedRows,
        setSelectedRows,
        refresh,
        updateGroup: updateItem,
        deleteGroup: deleteItem,
        createGroup: createItem,
        pagination,
        setPagination,
        open,
        setOpen,
        currentRow,
        setCurrentRow,
      }}
    >
      {children}
    </GroupsContext.Provider>
  )
}

export const useGroups = () => {
  const context = useContext(GroupsContext)
  if (!context) {
    throw new Error('useGroups must be used within GroupsProvider')
  }
  return context
}
