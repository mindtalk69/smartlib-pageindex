'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useKnowledges } from './knowledges-provider'

export function KnowledgesPrimaryButtons() {
  const { setOpen } = useKnowledges()

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <Plus size={18} />
        <span>Add Knowledge</span>
      </Button>
    </div>
  )
}
