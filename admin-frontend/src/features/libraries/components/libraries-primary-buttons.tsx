'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLibraries } from './libraries-provider'

export function LibrariesPrimaryButtons() {
  const { setOpen } = useLibraries()

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <Plus size={18} />
        <span>Add Library</span>
      </Button>
    </div>
  )
}
