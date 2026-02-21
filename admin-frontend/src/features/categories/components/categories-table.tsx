'use client'

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
import { useCategoriesColumns } from './categories-columns'
import { useCategories } from './categories-provider'
import { CategoriesDialogs } from './categories-dialogs'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function CategoriesTable({ search, navigate }: DataTableProps) {
  const {
    open,
    setOpen,
    currentRow,
    setCurrentRow,
    selectedRows,
    setSelectedRows,
    pagination,
    setPagination,
    categories,
    isLoading,
    total,
  } = useCategories()

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const columns = useCategoriesColumns({ navigate })

  useEffect(() => {
    const pageFromUrl = typeof search.page === 'number' ? search.page : 1
    const pageSizeFromUrl = typeof search.pageSize === 'number' ? search.pageSize : 10
    setPagination({
      pageIndex: pageFromUrl - 1,
      pageSize: pageSizeFromUrl,
    })
  }, [search.page, search.pageSize, setPagination])

  useEffect(() => {
    navigate({
      search: {
        ...search,
        page: pagination.pageIndex + 1 > 1 ? pagination.pageIndex + 1 : undefined,
        pageSize: pagination.pageSize !== 10 ? pagination.pageSize : undefined,
      },
    })
  }, [pagination])

  const table = useReactTable({
    data: categories,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setSelectedRows,
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
        searchPlaceholder='Filter categories...'
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
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
                  No categories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <CategoriesDialogs />
    </div>
  )
}
