'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type Provider } from '@/lib/api-client'
import { useProviders } from './providers-provider'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { deleteProvider } = useProviders()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkDelete = async () => {
    const selectedProviders = selectedRows.map((row) => row.original as Provider)
    let successCount = 0
    let errorCount = 0

    for (const provider of selectedProviders) {
      const success = await deleteProvider(provider.id)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    }

    table.resetRowSelection()

    if (errorCount === 0) {
      toast.success(`Deleted ${successCount} provider${successCount > 1 ? 's' : ''}`)
    } else {
      toast.error(`Deleted ${successCount} providers, ${errorCount} failed`)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='provider'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected providers'
              title='Delete selected providers'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected providers</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected providers</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      {showDeleteConfirm && (
        <ProvidersMultiDeleteDialog
          table={table}
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          onConfirm={handleBulkDelete}
        />
      )}
    </>
  )
}

function ProvidersMultiDeleteDialog<TData>({
  table,
  open,
  onOpenChange,
  onConfirm,
}: {
  table: Table<TData>
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const CONFIRM_WORD = 'DELETE'

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedProviders = selectedRows.map((row) => row.original as Provider)

  const handleDelete = async () => {
    if (value.trim() !== CONFIRM_WORD) return

    setIsLoading(true)
    await onConfirm()
    setIsLoading(false)
    setValue('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            Delete {selectedProviders.length} {selectedProviders.length > 1 ? 'providers' : 'provider'}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <p>
            Are you sure you want to delete the selected providers?
            <br />
            This action cannot be undone.
          </p>
          <div className='space-y-2'>
            <Label>Confirm by typing "{CONFIRM_WORD}":</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Type "${CONFIRM_WORD}" to confirm.`}
            />
          </div>
          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              This operation cannot be rolled back.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={handleDelete} disabled={value !== CONFIRM_WORD || isLoading}>
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
