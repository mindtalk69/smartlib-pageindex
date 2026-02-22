'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { type File } from '../hooks/use-files'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'

export function useFilesColumns(): ColumnDef<File>[] {
  return [
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
        <span>{row.getValue('library_name') || 'N/A'}</span>
      ),
    },
    {
      accessorKey: 'knowledge_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Knowledge' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('knowledge_name') || 'N/A'}</span>
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
  ]
}
