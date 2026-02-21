'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LibrariesTable } from './components/libraries-table'
import { LibrariesProvider } from './components/libraries-provider'
import { LibrariesDialogs } from './components/libraries-dialogs'
import { LibrariesPrimaryButtons } from './components/libraries-primary-buttons'

const route = getRouteApi('/_authenticated/libraries/')

export function Libraries() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <LibrariesProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>Libraries</h2>
            <p className='text-muted-foreground'>
              Manage document libraries and collections.
            </p>
          </div>
          <LibrariesPrimaryButtons />
        </div>
        <LibrariesTable search={search} navigate={navigate} />
      </Main>

      <LibrariesDialogs />
    </LibrariesProvider>
  )
}
