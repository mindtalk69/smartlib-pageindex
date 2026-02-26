/**
 * UsersPage Component - Internal component integrating useUsers hook with UserList and UserDialog
 *
 * This component is internal to the pages/Users.tsx file and handles
 * all the state management and API integration.
 */

import { useState, useCallback } from 'react'
import { useUsers, User } from '@/hooks/useUsers'
import { UserList } from '@/components/users/UserList'
import { UserDialog } from '@/components/users/UserDialog'
import { toast } from 'sonner'

export interface UsersPageProps {
  page: number
  perPage: number
  search: string
  onPageChange: (page: number) => void
  onSearchChange: (search: string) => void
}

/**
 * Internal component that integrates the useUsers hook
 */
function UsersPageContent({ page, perPage, search, onPageChange, onSearchChange }: UsersPageProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const {
    users,
    pagination,
    isLoading,
    error,
    refresh,
    nextPage,
    prevPage,
    actions,
  } = useUsers({
    page,
    perPage,
    search: search || undefined,
  })

  // Handle user selection from list
  const handleUserSelect = useCallback((user: User) => {
    setSelectedUser(user)
    setDialogOpen(true)
  }, [])

  // Handle dialog open change
  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setSelectedUser(null)
    }
  }, [])

  // Handle page changes from pagination
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage !== pagination.page) {
      onPageChange(newPage)
    }
  }, [pagination.page, onPageChange])

  // Handle success messages
  const handleSuccess = useCallback((message: string) => {
    toast.success(message)
  }, [])

  // Handle error messages
  const handleError = useCallback((message: string) => {
    toast.error(message)
  }, [])

  // Handle toggle admin status
  const handleToggleAdmin = useCallback(async (userId: string) => {
    try {
      const result = await actions.toggleAdmin(userId)
      if (result.success) {
        toast.success('Admin status updated')
      } else {
        toast.error(result.error || 'Failed to update admin status')
      }
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update admin status'
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [actions])

  // Handle toggle active status
  const handleToggleActive = useCallback(async (userId: string) => {
    try {
      const result = await actions.toggleActive(userId)
      if (result.success) {
        toast.success('User status updated')
      } else {
        toast.error(result.error || 'Failed to update user status')
      }
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update user status'
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [actions])

  // Handle reset password
  const handleResetPassword = useCallback(async (userId: string) => {
    try {
      const result = await actions.resetPassword(userId)
      if (result.success && result.tempPassword) {
        navigator.clipboard.writeText(result.tempPassword)
        toast.success(`Password reset. Temp: ${result.tempPassword} (copied)`)
      } else if (result.error) {
        toast.error(result.error)
      }
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to reset password'
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [actions])

  // Handle delete user
  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      const result = await actions.deleteUser(userId)
      if (result.success) {
        toast.success('User deleted')
      } else {
        toast.error(result.error || 'Failed to delete user')
      }
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user'
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [actions])

  return (
    <>
      <UserList
        users={users}
        pagination={pagination}
        search={search}
        onSearchChange={onSearchChange}
        onPageChange={handlePageChange}
        onUserSelect={handleUserSelect}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
        onNextPage={nextPage}
        onPrevPage={prevPage}
        onToggleAdmin={handleToggleAdmin}
        onToggleActive={handleToggleActive}
        onResetPassword={handleResetPassword}
        onDeleteUser={handleDeleteUser}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <UserDialog
        user={selectedUser}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onToggleAdmin={actions.toggleAdmin}
        onToggleActive={actions.toggleActive}
        onResetPassword={actions.resetPassword}
        onDeleteUser={actions.deleteUser}
        onSuccess={handleSuccess}
        onError={handleError}
        onRefresh={refresh}
      />
    </>
  )
}

// Export as UsersPage for use in pages/Users.tsx
export function UsersPage(props: UsersPageProps) {
  return <UsersPageContent {...props} />
}
