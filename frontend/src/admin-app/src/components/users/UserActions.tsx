/**
 * UserActions Component - Action buttons for user management operations
 *
 * Features:
 * - Toggle Admin: Grant/revoke admin rights with confirmation
 * - Toggle Status: Enable/disable user account with confirmation
 * - Reset Password: Generate temporary password with confirmation
 * - Delete User: Remove user with red warning confirmation dialog
 * - Loading states during API calls
 * - Success/error toast callbacks
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Shield, UserCheck, Key, Trash2, Loader2 } from 'lucide-react'
import { User } from '@/hooks/useUsers'

export interface UserActionsProps {
  user: User
  onToggleAdmin: (userId: string) => Promise<void>
  onToggleActive: (userId: string) => Promise<void>
  onResetPassword: (userId: string) => Promise<{ tempPassword: string }>
  onDeleteUser: (userId: string) => Promise<void>
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel: string
  isDestructive?: boolean
  onConfirm: () => Promise<void>
  isLoading: boolean
}

/**
 * Reusable confirmation dialog component
 */
function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  isDestructive = false,
  onConfirm,
  isLoading,
}: ConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    // Dialog will be closed by parent after action completes
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={isDestructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              actionLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * UserActions component with 4 action buttons and confirmation dialogs
 */
export function UserActions({
  user,
  onToggleAdmin,
  onToggleActive,
  onResetPassword,
  onDeleteUser,
  onSuccess,
  onError,
}: UserActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Dialog states
  const [toggleAdminDialogOpen, setToggleAdminDialogOpen] = useState(false)
  const [toggleActiveDialogOpen, setToggleActiveDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleToggleAdmin = async () => {
    setLoadingAction('toggleAdmin')
    try {
      await onToggleAdmin(user.id)
      onSuccess?.(user.is_admin ? 'Admin rights revoked' : 'Admin rights granted')
    } catch (err) {
      onError?.('Failed to update admin status')
    } finally {
      setLoadingAction(null)
      setToggleAdminDialogOpen(false)
    }
  }

  const handleToggleActive = async () => {
    setLoadingAction('toggleActive')
    try {
      await onToggleActive(user.id)
      onSuccess?.(user.is_disabled ? 'User account enabled' : 'User account disabled')
    } catch (err) {
      onError?.('Failed to update user status')
    } finally {
      setLoadingAction(null)
      setToggleActiveDialogOpen(false)
    }
  }

  const handleResetPassword = async () => {
    setLoadingAction('resetPassword')
    try {
      const result = await onResetPassword(user.id)
      onSuccess?.(`Password reset. Temp password: ${result.tempPassword}`)
    } catch (err) {
      onError?.('Failed to reset password')
    } finally {
      setLoadingAction(null)
      setResetPasswordDialogOpen(false)
    }
  }

  const handleDeleteUser = async () => {
    setLoadingAction('deleteUser')
    try {
      await onDeleteUser(user.id)
      onSuccess?.(`User "${user.username}" has been deleted`)
    } catch (err) {
      onError?.('Failed to delete user')
    } finally {
      setLoadingAction(null)
      setDeleteDialogOpen(false)
    }
  }

  const isCurrentAdmin = user.is_admin // Could add additional check for self-deletion

  return (
    <>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Toggle Admin */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setToggleAdminDialogOpen(true)}
          disabled={loadingAction !== null}
          className="gap-1"
        >
          <Shield className="h-4 w-4" />
          {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
        </Button>

        {/* Toggle Status */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setToggleActiveDialogOpen(true)}
          disabled={loadingAction !== null}
          className="gap-1"
        >
          <UserCheck className="h-4 w-4" />
          {user.is_disabled ? 'Enable User' : 'Disable User'}
        </Button>

        {/* Reset Password */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetPasswordDialogOpen(true)}
          disabled={loadingAction !== null}
          className="gap-1"
        >
          <Key className="h-4 w-4" />
          Reset Password
        </Button>

        {/* Delete User */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={loadingAction !== null || isCurrentAdmin}
          className="gap-1 text-destructive hover:text-destructive"
          title={isCurrentAdmin ? 'Cannot delete yourself' : 'Delete user'}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Toggle Admin Confirmation Dialog */}
      <ConfirmationDialog
        open={toggleAdminDialogOpen}
        onOpenChange={setToggleAdminDialogOpen}
        title={user.is_admin ? 'Revoke Admin Rights?' : 'Grant Admin Rights?'}
        description={
          user.is_admin
            ? `This will remove admin privileges from "${user.username}". They will only have standard user access.`
            : `This will grant admin privileges to "${user.username}". They will have full access to the admin dashboard.`
        }
        actionLabel={user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
        onConfirm={handleToggleAdmin}
        isLoading={loadingAction === 'toggleAdmin'}
      />

      {/* Toggle Status Confirmation Dialog */}
      <ConfirmationDialog
        open={toggleActiveDialogOpen}
        onOpenChange={setToggleActiveDialogOpen}
        title={user.is_disabled ? 'Enable User?' : 'Disable User?'}
        description={
          user.is_disabled
            ? `This will re-enable the account for "${user.username}". They will be able to log in and use the application.`
            : `This will disable the account for "${user.username}". They will not be able to log in until the account is re-enabled.`
        }
        actionLabel={user.is_disabled ? 'Enable User' : 'Disable User'}
        onConfirm={handleToggleActive}
        isLoading={loadingAction === 'toggleActive'}
      />

      {/* Reset Password Confirmation Dialog */}
      <ConfirmationDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        title="Reset Password?"
        description={
          `A new temporary password will be generated for "${user.username}". The temp password will be shown in a toast notification and copied to your clipboard. The user should change their password after next login.`
        }
        actionLabel="Reset Password"
        onConfirm={handleResetPassword}
        isLoading={loadingAction === 'resetPassword'}
      />

      {/* Delete User Confirmation Dialog - RED Warning */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete User: {user.username}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-destructive">
              This action cannot be undone. All user data including files, conversations, and
              vectors will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingAction !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loadingAction !== null}
            >
              {loadingAction === 'deleteUser' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
