import { useEffect, useState } from 'react'
import {
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { type NavigateFn } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { usersColumns as columns } from './users-columns'
import { useUsers } from './users-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function UsersTable({ search, navigate }: DataTableProps) {
  const {
    users,
    isLoading,
    total,
    rowSelection,
    setRowSelection,
    refresh,
  } = useUsers()

  // Local UI-only states
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Pagination state
  const [pagination, setPagination] = useState({
    pageIndex: (typeof search.page === 'number' ? search.page : 1) - 1,
    pageSize: typeof search.pageSize === 'number' ? search.pageSize : 10,
  })

  // Sync pagination with URL
  useEffect(() => {
    const pageFromUrl = typeof search.page === 'number' ? search.page : 1
    const pageSizeFromUrl = typeof search.pageSize === 'number' ? search.pageSize : 10
    setPagination({
      pageIndex: pageFromUrl - 1,
      pageSize: pageSizeFromUrl,
    })
  }, [search.page, search.pageSize])

  // Sync URL when pagination changes
  useEffect(() => {
    navigate({
      search: {
        ...search,
        page: pagination.pageIndex + 1 > 1 ? pagination.pageIndex + 1 : undefined,
        pageSize: pagination.pageSize !== 10 ? pagination.pageSize : undefined,
      },
    })
  }, [pagination]) // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: total ? Math.ceil(total / pagination.pageSize) : undefined,
  })

  if (isLoading) {
    return (
      <div className='flex flex-1 flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-8 w-[200px]' />
          <Skeleton className='h-8 w-[150px]' />
        </div>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((_, index) => (
                  <TableHead key={index}>
                    <Skeleton className='h-4 w-full' />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((_, colIndex) => (
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
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder='Filter users...'
        filters={[
          {
            columnId: 'is_disabled',
            title: 'Status',
            options: [
              { label: 'Active', value: 'false' },
              { label: 'Inactive', value: 'true' },
            ],
          },
          {
            columnId: 'is_admin',
            title: 'Role',
            options: [
              { label: 'Admin', value: 'true' },
              { label: 'User', value: 'false' },
            ],
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
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
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} entityName='user' />
    </div>
  )
}
