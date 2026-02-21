'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { type Category } from '../data/schema'
import { useCategories } from './categories-provider'

type CategoriesDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Category
}

export function CategoriesDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: CategoriesDeleteDialogProps) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { deleteCategory } = useCategories()

  const handleDelete = async () => {
    if (value.trim() !== currentRow.name) return

    setIsLoading(true)
    const success = await deleteCategory(currentRow.id)
    setIsLoading(false)

    if (success) {
      toast.success(`Category "${currentRow.name}" has been deleted`)
      onOpenChange(false)
    } else {
      toast.error('Failed to delete category')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            Delete Category
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className='font-bold text-foreground'>
              {currentRow.name}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>
              Type <strong>"{currentRow.name}"</strong> to confirm:
            </Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentRow.name}
            />
          </div>
          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Please be careful, this operation cannot be rolled back.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={value.trim() !== currentRow.name || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
