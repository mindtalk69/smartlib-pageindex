/**
 * AdminTable Component
 * Reusable table component for admin panel with CRUD actions
 */

import * as React from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/data-table/pagination'
import { DataTableToolbar } from '@/components/data-table/toolbar'
import { DataTableBulkActions } from '@/components/data-table/bulk-actions'
import { AdminDeleteDialog } from '@/components/admin/admin-delete-dialog'

export interface AdminTableColumn<TData> extends ColumnDef<TData> {
  accessorKey?: string
  headerLabel?: string
  cellType?: 'text' | 'badge' | 'action' | 'custom'
  renderCell?: (item: TData) => React.ReactNode
  filterOptions?: { label: string; value: string }[]
}

export interface AdminTableProps<TData> {
  /** Table columns definition */
  columns: ColumnDef<TData>[]
  /** Data to display */
  data: TData[]
  /** Loading state */
  isLoading?: boolean
  /** Entity name for bulk actions */
  entityName?: string
  /** Search placeholder */
  searchPlaceholder?: string
  /** Search key (column to search) */
  searchKey?: string
  /** Additional filters */
  filters?: {
    columnId: string
    title: string
    options: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[]
  }[]
  /** Show row actions (edit/delete) */
  showActions?: boolean
  /** Handle edit action */
  onEdit?: (item: TData) => void
  /** Handle delete action */
  onDelete?: (item: TData) => void
  /** Custom actions to render in bulk actions toolbar */
  bulkActions?: React.ReactNode
  /** Pagination state */
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  /** Callback when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void
  /** Total items (for server-side pagination) */
  totalItems?: number
  /** Column filters state */
  columnFilters?: ColumnFiltersState
  /** Callback when column filters change */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void
  /** Global filter value */
  globalFilter?: string
  /** Callback when global filter changes */
  onGlobalFilterChange?: (value: string) => void
  /** Custom class name */
  className?: string
}

export function AdminTable<TData>({
  columns,
  data,
  isLoading = false,
  entityName = 'item',
  searchPlaceholder = 'Filter...',
  searchKey,
  filters = [],
  showActions = true,
  onEdit,
  onDelete,
  bulkActions,
  pagination,
  onPaginationChange,
  totalItems,
  columnFilters = [],
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
  className,
}: AdminTableProps<TData>) {
  // Row selection state
  const [rowSelection, setRowSelection] = React.useState({})

  // Add action column if showActions is true
  const columnsWithActions = React.useMemo(() => {
    if (!showActions) return columns

    const actionsColumn: ColumnDef<TData> = {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex items-center gap-2'>
          {onEdit && (
            <Button
              variant='ghost'
              size='icon'
              onClick={() => onEdit(row.original as TData)}
              className='h-8 w-8'
            >
              <Pencil className='h-4 w-4' />
              <span className='sr-only'>Edit</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              onClick={() => onDelete(row.original as TData)}
              className='h-8 w-8 text-destructive hover:text-destructive'
            >
              <Trash2 className='h-4 w-4' />
              <span className='sr-only'>Delete</span>
            </Button>
          )}
        </div>
      ),
    }

    return [...columns, actionsColumn]
  }, [columns, showActions, onEdit, onDelete])

  const table = useReactTable({
    data,
    columns: columnsWithActions,
    state: {
      rowSelection,
      columnFilters,
      globalFilter,
      pagination: pagination ? {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      } : undefined,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalItems ? Math.ceil(totalItems / (pagination?.pageSize || 10)) : undefined,
  })

  if (isLoading) {
    return (
      <div className={cn('w-full space-y-4', className)}>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-8 w-[200px]' />
          <Skeleton className='h-8 w-[150px]' />
        </div>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                {columnsWithActions.map((_, index) => (
                  <TableHead key={index}>
                    <Skeleton className='h-4 w-full' />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columnsWithActions.map((_, colIndex) => (
                    <TableCell key={colIndex}>
                      <Skeleton className='h-4 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchKey={searchKey}
        filters={filters}
      />

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnsWithActions.length}
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

      {bulkActions && (
        <DataTableBulkActions table={table} entityName={entityName}>
          {bulkActions}
        </DataTableBulkActions>
      )}
    </div>
  )
}

export default AdminTable
