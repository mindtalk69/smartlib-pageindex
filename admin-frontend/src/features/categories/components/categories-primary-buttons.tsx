'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCategories } from './categories-provider'

export function CategoriesPrimaryButtons() {
  const { setOpen } = useCategories()

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <Plus size={18} />
        <span>Add Category</span>
      </Button>
    </div>
  )
}
