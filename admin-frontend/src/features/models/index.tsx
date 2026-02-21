'use client'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

export function ModelsPage() {
  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>LLM Models</h2>
            <p className='text-muted-foreground'>
              Manage your LLM model deployments and configurations.
            </p>
          </div>
        </div>

        <Alert>
          <Loader2 className='h-4 w-4 animate-spin' />
          <AlertTitle>Page Under Development</AlertTitle>
          <AlertDescription className='mt-2'>
            <p className='mb-2'>
              The LLM Models management page is currently being developed.
            </p>
            <p className='text-sm text-muted-foreground'>
              In the meantime, you can configure models through the Flask admin interface or check back later.
            </p>
            <Badge variant='outline' className='mt-2'>Coming Soon</Badge>
          </AlertDescription>
        </Alert>

        <div className='rounded-md border p-6'>
          <h3 className='text-lg font-semibold mb-2'>What's Coming</h3>
          <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
            <li>Add and manage LLM model deployments</li>
            <li>Configure model settings (temperature, streaming)</li>
            <li>Set default models for your application</li>
            <li>View model capabilities and providers</li>
          </ul>
        </div>
      </Main>
    </>
  )
}
