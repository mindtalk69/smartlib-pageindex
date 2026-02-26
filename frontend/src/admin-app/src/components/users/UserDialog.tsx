/**
 * UserDialog Component - Dialog for viewing user details
 *
 * Features:
 * - Displays all user fields (username, email, is_admin, is_disabled, created_at, etc.)
 * - Two-column layout for user details
 * - Formatted dates (YYYY-MM-DD HH:mm)
 * - Badges for role and status
 * - Email as mailto link
 * - Copy button for User ID
 * - User action buttons (toggle admin, toggle status, reset password, delete)
 * - Loading and error states
 */

import { User } from '@/hooks/useUsers'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Mail, User as UserIcon, Shield, AlertCircle, Calendar, Clock } from 'lucide-react'
import { useState } from 'react'
import { UserActions } from './UserActions'

export interface UserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleAdmin?: (userId: string) => Promise<{ success: boolean; error?: string }>
  onToggleActive?: (userId: string) => Promise<{ success: boolean; error?: string }>
  onResetPassword?: (userId: string) => Promise<{ success: boolean; tempPassword?: string; error?: string }>
  onDeleteUser?: (userId: string) => Promise<{ success: boolean; error?: string }>
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
  onRefresh?: () => void
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text)
}

/**
 * UserDialog component for displaying user details
 */
export function UserDialog({
  user,
  open,
  onOpenChange,
  onToggleAdmin,
  onToggleActive,
  onResetPassword,
  onDeleteUser,
  onSuccess,
  onError,
  onRefresh,
}: UserDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyUserId = () => {
    if (user?.user_id) {
      copyToClipboard(user.user_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyToClipboard = (text: string) => {
    copyToClipboard(text)
  }

  const handleToggleAdmin = async (userId: string) => {
    if (onToggleAdmin) {
      const result = await onToggleAdmin(userId)
      if (!result.success) {
        onError?.(result.error || 'Failed to update admin status')
      }
      onRefresh?.()
    }
  }

  const handleToggleActive = async (userId: string) => {
    if (onToggleActive) {
      const result = await onToggleActive(userId)
      if (!result.success) {
        onError?.(result.error || 'Failed to update user status')
      }
      onRefresh?.()
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (onResetPassword) {
      const result = await onResetPassword(userId)
      if (result.success && result.tempPassword) {
        // Copy temp password to clipboard
        handleCopyToClipboard(result.tempPassword)
      }
      onRefresh?.()
      return { tempPassword: result.tempPassword || '' }
    }
    return { tempPassword: '' }
  }

  const handleDeleteUser = async (userId: string) => {
    if (onDeleteUser) {
      const result = await onDeleteUser(userId)
      if (!result.success) {
        onError?.(result.error || 'Failed to delete user')
      }
      onRefresh?.()
      onOpenChange(false) // Close dialog after deletion
    }
  }

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {user.username}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* User ID with copy button */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span className="text-sm font-medium">User ID</span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <code className="relative flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
                {user.user_id}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyUserId}
                title={copied ? 'Copied!' : 'Copy User ID'}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Username */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Username</span>
            </div>
            <div className="col-span-2">
              <span className="text-sm">{user.username}</span>
            </div>
          </div>

          {/* Email */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Email</span>
            </div>
            <div className="col-span-2">
              <a
                href={`mailto:${user.email}`}
                className="text-sm text-primary hover:underline"
              >
                {user.email}
              </a>
            </div>
          </div>

          {/* Role */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Role</span>
            </div>
            <div className="col-span-2">
              <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                {user.is_admin ? 'Admin' : 'User'}
              </Badge>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <div className="col-span-2">
              <Badge variant={user.is_disabled ? 'destructive' : 'outline'}>
                {user.is_disabled ? 'Disabled' : 'Active'}
              </Badge>
            </div>
          </div>

          {/* Created At */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Created At</span>
            </div>
            <div className="col-span-2">
              <span className="text-sm">{formatDate(user.created_at)}</span>
            </div>
          </div>

          {/* Updated At */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Updated At</span>
            </div>
            <div className="col-span-2">
              <span className="text-sm">{formatDate(user.updated_at)}</span>
            </div>
          </div>

          {/* Last Login */}
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Last Login</span>
            </div>
            <div className="col-span-2">
              <span className="text-sm">{formatDate(user.last_login) || 'Never'}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">User Actions</h3>
          <UserActions
            user={user}
            onToggleAdmin={handleToggleAdmin}
            onToggleActive={handleToggleActive}
            onResetPassword={handleResetPassword}
            onDeleteUser={handleDeleteUser}
            onSuccess={onSuccess}
            onError={onError}
          />
        </div>

        {/* Close button */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
