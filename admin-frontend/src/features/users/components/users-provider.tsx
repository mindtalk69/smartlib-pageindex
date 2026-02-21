import React, { useState, useEffect } from 'react'
import { useAdminCrud } from '@/hooks/use-admin-crud'
import { usersApi, type User } from '@/lib/api-client'
import useDialogState from '@/hooks/use-dialog-state'

type UsersDialogType = 'invite' | 'add' | 'edit' | 'delete'

type UsersContextType = {
  open: UsersDialogType | null
  setOpen: (str: UsersDialogType | null) => void
  currentRow: User | null
  setCurrentRow: React.Dispatch<React.SetStateAction<User | null>>
  // CRUD state
  users: User[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  // CRUD actions
  refresh: () => Promise<void>
  updateUser: (id: string, data: Partial<User>) => Promise<boolean>
  deleteUser: (id: string) => Promise<boolean>
  // For row selection in bulk actions
  rowSelection: Record<string, boolean>
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

const UsersContext = React.createContext<UsersContextType | null>(null)

interface UsersProviderProps {
  children: React.ReactNode
  search: Record<string, unknown>
  navigate: (opts: { search: Record<string, unknown>; replace?: boolean }) => void
}

export function UsersProvider({ children, search, navigate }: UsersProviderProps) {
  const [open, setOpen] = useDialogState<UsersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<User | null>(null)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  // Use the CRUD hook for API calls
  const {
    items: users,
    isLoading,
    error,
    page,
    perPage,
    total,
    totalPages,
    refresh,
    updateItem,
    deleteItem,
    setPage,
    setPerPage,
  } = useAdminCrud({
    fetchAll: usersApi.getAll,
    fetchById: usersApi.getById,
    update: usersApi.update,
    delete: usersApi.delete,
    create: async () => ({ success: false, error: 'Not implemented' }), // Placeholder for future add user
    messages: {
      updateSuccess: 'User updated successfully',
      deleteSuccess: 'User deleted successfully',
      error: 'Operation failed',
    },
  })

  // Sync pagination with URL params
  useEffect(() => {
    const pageFromUrl = typeof search.page === 'number' ? search.page : 1
    const pageSizeFromUrl = typeof search.pageSize === 'number' ? search.pageSize : 10
    setPage(pageFromUrl)
    setPerPage(pageSizeFromUrl)
  }, [search.page, search.pageSize, setPage, setPerPage])

  // Update URL when pagination changes
  useEffect(() => {
    navigate({
      search: {
        ...search,
        page: page > 1 ? page : undefined,
        pageSize: perPage !== 10 ? perPage : undefined,
      },
    })
  }, [page, perPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: UsersContextType = {
    open,
    setOpen,
    currentRow,
    setCurrentRow,
    users,
    isLoading,
    error,
    total,
    totalPages,
    refresh,
    updateUser: updateItem,
    deleteUser: deleteItem,
    rowSelection,
    setRowSelection,
  }

  return (
    <UsersContext value={contextValue}>
      {children}
    </UsersContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUsers = () => {
  const usersContext = React.useContext(UsersContext)

  if (!usersContext) {
    throw new Error('useUsers has to be used within <UsersProvider>')
  }

  return usersContext
}
