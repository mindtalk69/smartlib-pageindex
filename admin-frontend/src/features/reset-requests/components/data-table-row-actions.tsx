'use client'

import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type ResetRequest } from '../data/schema'
import { useResetRequests } from './reset-requests-provider'

interface DataTableRowActionsProps {
  row: Row<ResetRequest>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const resetRequest = row.original
  const { setOpen, setCurrentRow } = useResetRequests()

  const isPending = resetRequest.status === 'pending'
  const isCompleted = resetRequest.status === 'completed'
  const isDenied = resetRequest.status === 'denied'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem
          disabled={!isPending}
          onClick={() => {
            setCurrentRow(resetRequest)
            setOpen('approve')
          }}
        >
          Approve
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!isPending}
          onClick={() => {
            setCurrentRow(resetRequest)
            setOpen('deny')
          }}
        >
          Deny
        </DropdownMenuItem>
        {isCompleted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Completed</DropdownMenuItem>
          </>
        )}
        {isDenied && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Denied</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
