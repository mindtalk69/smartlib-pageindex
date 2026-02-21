'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { type Provider } from '@/lib/api-client'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<Provider>[] = [
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
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className='font-medium'>
        {row.original.name}
        {row.original.is_default && (
          <Badge variant='secondary' className='ms-2'>
            Default
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'provider_type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant='outline'>{row.original.provider_type}</Badge>
    ),
  },
  {
    accessorKey: 'base_url',
    header: 'Base URL',
    cell: ({ row }) => (
      <div className='max-w-[300px] truncate text-muted-foreground'>
        {row.original.base_url || 'N/A'}
      </div>
    ),
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) =>
      row.original.is_active ? (
        <Badge variant='default'>Active</Badge>
      ) : (
        <Badge variant='secondary'>Inactive</Badge>
      ),
  },
  {
    accessorKey: 'health_status',
    header: 'Health',
    cell: ({ row }) => {
      const status = row.original.health_status
      if (!status) return <Badge variant='secondary'>Unknown</Badge>
      if (status === 'healthy') return <Badge variant='default'>Healthy</Badge>
      if (status === 'degraded') return <Badge variant='warning'>Degraded</Badge>
      return <Badge variant='destructive'>Offline</Badge>
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
