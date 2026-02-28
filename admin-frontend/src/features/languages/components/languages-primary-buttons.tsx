'use client'

import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import { useLanguagesContext } from './languages-provider'

export function LanguagesPrimaryButtons() {
  const { refresh, setActionDialogOpen, setCurrentRow } = useLanguagesContext()

  return (
    <div className='flex items-center gap-2'>
      <Button variant='default' size='sm' onClick={() => {
        setCurrentRow(null)
        setActionDialogOpen(true)
      }}>
        <Plus className='h-4 w-4' />
        Add Language
      </Button>
      <Button variant='outline' size='sm' onClick={() => refresh()}>
        <RefreshCw className='h-4 w-4' />
        Refresh
      </Button>
    </div>
  )
}
