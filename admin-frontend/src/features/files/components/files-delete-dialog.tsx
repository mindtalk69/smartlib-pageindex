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
import { type File } from '../data/schema'
import { useFiles } from './files-provider'

type FilesDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: File
}

export function FilesDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: FilesDeleteDialogProps) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { deleteFile } = useFiles()

  const handleDelete = async () => {
    if (value.trim() !== currentRow.filename) return

    setIsLoading(true)
    const success = await deleteFile(currentRow.id)
    setIsLoading(false)

    if (success) {
      toast.success(`File "${currentRow.filename}" has been deleted`)
      onOpenChange(false)
    } else {
      toast.error('Failed to delete file')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            Delete File
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className='font-bold text-foreground'>
              {currentRow.filename}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label>
              Type <strong>"{currentRow.filename}"</strong> to confirm:
            </Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={currentRow.filename}
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
            disabled={value.trim() !== currentRow.filename || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
