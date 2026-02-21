'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProvidersTable } from './components/providers-table'
import { ProvidersProvider } from './components/providers-provider'
import { ProvidersDialogs } from './components/providers-dialogs'
import { ProvidersPrimaryButtons } from './components/providers-primary-buttons'

const route = getRouteApi('/_authenticated/providers/')

export function Providers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <ProvidersProvider>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>LLM Providers</h2>
            <p className='text-muted-foreground'>
              Manage your LLM providers and API connections.
            </p>
          </div>
          <ProvidersPrimaryButtons />
        </div>
        <ProvidersTable search={search} navigate={navigate} />
      </Main>

      <ProvidersDialogs />
    </ProvidersProvider>
  )
}
