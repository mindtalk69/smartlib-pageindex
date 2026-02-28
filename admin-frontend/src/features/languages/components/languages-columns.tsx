'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { type Language } from '../hooks/use-languages'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { DataTableRowActions } from './data-table-row-actions'

interface UseLanguagesColumnsOptions {
  onEdit: (row: Language) => void
  onDelete: (row: Language) => void
}

export function useLanguagesColumns(options?: UseLanguagesColumnsOptions): ColumnDef<Language>[] {
  const { onEdit, onDelete } = options || {}

  return [
    {
      accessorKey: 'language_code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Code' />
      ),
      cell: ({ row }) => (
        <div className='font-medium'>
          {row.getValue('language_code')}
        </div>
      ),
    },
    {
      accessorKey: 'language_name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('language_name')}</span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_by',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Created By' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('created_by')}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Created' />
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue('created_at') as string | null
        if (!createdAt) return <span>N/A</span>
        return (
          <span className='text-sm text-muted-foreground'>
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        if (!onEdit || !onDelete) return null
        return <DataTableRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
      },
    },
  ]
}
