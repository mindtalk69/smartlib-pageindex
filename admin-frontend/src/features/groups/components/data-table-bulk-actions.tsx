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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type Group } from '../data/schema'
import { useGroups } from './groups-provider'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { deleteGroup } = useGroups()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkDelete = async () => {
    const selectedGroups = selectedRows.map((row) => row.original as Group)
    let successCount = 0
    let errorCount = 0

    for (const group of selectedGroups) {
      const success = await deleteGroup(group.id)
      if (success) {
        successCount++
      } else {
        errorCount++
      }
    }

    table.resetRowSelection()

    if (errorCount === 0) {
      toast.success(`Deleted ${successCount} group${successCount > 1 ? 's' : ''}`)
    } else {
      toast.error(`Deleted ${successCount} groups, ${errorCount} failed`)
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='group'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Delete selected groups'
              title='Delete selected groups'
            >
              <Trash2 />
              <span className='sr-only'>Delete selected groups</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete selected groups</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      {showDeleteConfirm && (
        <GroupsMultiDeleteDialog
          table={table}
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          onConfirm={handleBulkDelete}
        />
      )}
    </>
  )
}

function GroupsMultiDeleteDialog<TData>({
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
  const selectedGroups = selectedRows.map((row) => row.original as Group)

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
            Delete {selectedGroups.length} {selectedGroups.length > 1 ? 'groups' : 'group'}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <p>
            Are you sure you want to delete the selected groups?
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
