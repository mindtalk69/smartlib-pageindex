'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCatalogs } from './catalogs-provider'

export function CatalogsPrimaryButtons() {
  const { setOpen } = useCatalogs()

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <Plus size={18} />
        <span>Add Catalog</span>
      </Button>
    </div>
  )
}
