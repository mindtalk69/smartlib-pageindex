'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProviders } from './providers-provider'

export function ProvidersPrimaryButtons() {
  const { setOpen } = useProviders()

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add Provider</span> <Plus size={18} />
      </Button>
    </div>
  )
}
