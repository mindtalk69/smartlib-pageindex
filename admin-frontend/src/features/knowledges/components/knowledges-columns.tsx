'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { type Knowledge } from '../data/schema'
import { DataTableColumnHeader } from '@/components/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKnowledges } from './knowledges-provider'
import { ExpandableList } from '@/components/expandable-text'

type KnowledgesColumnsProps = {
  navigate: (opts: { to: string; search?: Record<string, unknown> }) => void
}

export function useKnowledgesColumns({ navigate }: KnowledgesColumnsProps): ColumnDef<Knowledge>[] {
  const { setOpen, setCurrentRow } = useKnowledges()

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
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => (
        <div className='font-medium max-w-[200px] truncate'>
          {row.getValue('name')}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Description' />
      ),
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        return (
          <span className='max-w-[300px] truncate text-muted-foreground'>
            {description || 'N/A'}
          </span>
        )
      },
    },
    {
      accessorKey: 'catalog_names',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Catalogs' />
      ),
      cell: ({ row }) => {
        const catalogNames = row.getValue('catalog_names') as string[]
        return (
          <ExpandableList
            items={catalogNames}
            singularLabel='Catalog'
            pluralLabel='Catalogs'
            displayMode='badges'
          />
        )
      },
    },
    {
      accessorKey: 'library_names',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Libraries' />
      ),
      cell: ({ row }) => {
        const libraryNames = row.getValue('library_names') as string[]
        return (
          <ExpandableList
            items={libraryNames}
            singularLabel='Library'
            pluralLabel='Libraries'
            displayMode='badges'
          />
        )
      },
    },
    {
      accessorKey: 'group_names',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Groups' />
      ),
      cell: ({ row }) => {
        const groupNames = row.getValue('group_names') as string[]
        return (
          <ExpandableList
            items={groupNames}
            singularLabel='Group'
            pluralLabel='Groups'
            displayMode='badges'
          />
        )
      },
    },
    {
      accessorKey: 'created_by_username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Created By' />
      ),
      cell: ({ row }) => (
        <span>{row.getValue('created_by_username')}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Created At' />
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
        const knowledge = row.original

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
                  setCurrentRow(knowledge)
                  setOpen('edit')
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentRow(knowledge)
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
