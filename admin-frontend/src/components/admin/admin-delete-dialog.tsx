/**
 * AdminDeleteDialog Component
 * Reusable confirmation dialog for deleting admin resources
 */

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface AdminDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  itemName?: string
  itemType?: string
  confirmationText?: string
  description?: React.ReactNode
  children?: React.ReactNode
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
  className?: string
  destructive?: boolean
}

export function AdminDeleteDialog({
  open,
  onOpenChange,
  title = 'Delete Item',
  itemName,
  itemType = 'item',
  confirmationText,
  description,
  children,
  onConfirm,
  isLoading = false,
  className,
  destructive = true,
}: AdminDeleteDialogProps) {
  const [confirmInput, setConfirmInput] = React.useState('')

  // Reset input when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmInput('')
    }
  }, [open])

  const canDelete = confirmationText
    ? confirmInput.trim() === confirmationText
    : true

  const handleConfirm = async () => {
    if (!canDelete) return
    await onConfirm()
  }

  const defaultDescription = itemName ? (
    <>
      Are you sure you want to delete <strong>"{itemName}"</strong>? This action
      cannot be undone.
    </>
  ) : (
    <>Are you sure you want to delete this {itemType}? This action cannot be undone.</>
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn('sm:max-w-md', className)}>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-destructive' />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='text-sm'>
              {description || defaultDescription}
              {children}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmationText && (
          <div className='grid gap-2'>
            <label htmlFor='confirm-input' className='text-sm font-medium'>
              Type <strong>"{confirmationText}"</strong> to confirm:
            </label>
            <Input
              id='confirm-input'
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmationText}
              autoComplete='off'
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canDelete || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default AdminDeleteDialog
