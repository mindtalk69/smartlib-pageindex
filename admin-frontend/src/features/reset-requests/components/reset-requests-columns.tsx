import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { getStatusVariant } from '../data/schema'
import { type ResetRequest } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const resetRequestsColumns: ColumnDef<ResetRequest>[] = [
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
        className='translate-y-[2px]'
      />
    ),
    meta: {
      className: cn('max-md:sticky start-0 z-10 rounded-tl-[inherit]'),
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Username' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-36 ps-3'>{row.getValue('username')}</LongText>
    ),
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
        'ps-0.5 max-md:sticky start-6 @4xl/content:table-cell @4xl/content:drop-shadow-none'
      ),
    },
    enableHiding: false,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => {
      const email = row.getValue('email') as string | null
      return (
        <div className='w-fit ps-2 text-nowrap'>
          {email || <span className='text-muted-foreground'>No email</span>}
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge variant='outline' className={cn('capitalize', getStatusVariant(status))}>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableHiding: false,
  },
  {
    accessorKey: 'request_reason',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Reason' />
    ),
    cell: ({ row }) => {
      const reason = row.getValue('request_reason') as string | null
      return (
        <div className='max-w-md'>
          {reason ? (
            <LongText className='text-sm'>{reason}</LongText>
          ) : (
            <span className='text-muted-foreground'>No reason provided</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Requested' />
    ),
    cell: ({ row }) => {
      const date = row.getValue('created_at') as string
      return (
        <div className='text-sm'>
          {new Date(date).toLocaleString()}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'admin_notes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Admin Notes' />
    ),
    cell: ({ row }) => {
      const notes = row.getValue('admin_notes') as string | null
      return (
        <div className='max-w-md'>
          {notes ? (
            <LongText className='text-sm'>{notes}</LongText>
          ) : (
            <span className='text-muted-foreground'>-</span>
          )}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
