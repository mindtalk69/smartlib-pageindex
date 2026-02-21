'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useResetRequests } from './reset-requests-provider'

export function ResetRequestsPrimaryButtons() {
  const { refresh, isLoading } = useResetRequests()

  return (
    <div className='flex gap-2'>
      <Button variant='outline' onClick={() => refresh()} disabled={isLoading}>
        <RefreshCw className='mr-2 h-4 w-4' />
        Refresh
      </Button>
    </div>
  )
}
