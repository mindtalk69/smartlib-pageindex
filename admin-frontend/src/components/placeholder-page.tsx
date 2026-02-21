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

interface PlaceholderPageProps {
  title: string
  description: string
  features?: string[]
}

export function PlaceholderPage({ title, description, features }: PlaceholderPageProps) {
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
            <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
            <p className='text-muted-foreground'>{description}</p>
          </div>
        </div>

        <Alert>
          <Loader2 className='h-4 w-4 animate-spin' />
          <AlertTitle>Page Under Development</AlertTitle>
          <AlertDescription className='mt-2'>
            <p className='mb-2'>
              This page is currently being developed. Please check back later.
            </p>
            <Badge variant='outline' className='mt-2'>Coming Soon</Badge>
          </AlertDescription>
        </Alert>

        {features && features.length > 0 && (
          <div className='rounded-md border p-6'>
            <h3 className='text-lg font-semibold mb-2'>What&apos;s Coming</h3>
            <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
              {features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </Main>
    </>
  )
}
