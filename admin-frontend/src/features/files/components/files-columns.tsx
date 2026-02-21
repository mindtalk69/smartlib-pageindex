'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { type File } from '../data/schema'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFiles } from './files-provider'

type FilesColumnsProps = {
  navigate: (opts: { to: string; search?: Record<string, unknown> }) => void
}

export function useFilesColumns({ navigate }: FilesColumnsProps): ColumnDef<File>[] {
  const { setOpen, setCurrentRow } = useFiles()

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'filename',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Filename' />
      ),
      cell: ({ row }) => (
        <div className='font-medium max-w-[200px] truncate'>
          {row.getValue('filename')}
        </div>
      ),
    },
    {
      accessorKey: 'file_size',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Size' />
      ),
      cell: ({ row }) => {
        const size = row.getValue('file_size') as number
        const formatSize = (bytes: number) => {
          if (bytes === 0) return '0 B'
          const k = 1024
          const sizes = ['B', 'KB', 'MB', 'GB']
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
        }
        return <span>{formatSize(size)}</span>
      },
    },
    {
      accessorKey: 'upload_time',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Uploaded' />
      ),
      cell: ({ row }) => {
        const uploadTime = row.getValue('upload_time') as string | null
        if (!uploadTime) return <span>N/A</span>
        return (
          <span className='text-sm text-muted-foreground'>
            {formatDistanceToNow(new Date(uploadTime), { addSuffix: true })}
          </span>
        )
      },
    },
    {
      accessorKey: 'username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Uploaded By' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('username')}</span>
      ),
    },
    {
      accessorKey: 'library_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Library' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('library_name')}</span>
      ),
    },
    {
      accessorKey: 'knowledge_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Knowledge' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('knowledge_name')}</span>
      ),
    },
    {
      accessorKey: 'is_ocr',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='OCR' />
      ),
      cell: ({ row }) => {
        const isOcr = row.getValue('is_ocr') as boolean
        return (
          <Badge variant={isOcr ? 'default' : 'secondary'}>
            {isOcr ? 'Yes' : 'No'}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const file = row.original

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
                onClick={() => {
                  setCurrentRow(file)
                  setOpen('delete')
                }}
                className='text-destructive focus:text-destructive'
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
