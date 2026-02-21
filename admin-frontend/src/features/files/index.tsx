'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { FilesTable } from './components/files-table'
import { FilesProvider } from './components/files-provider'
import { FilesDialogs } from './components/files-dialogs'

const route = getRouteApi('/_authenticated/files/')

export function Files() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <FilesProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>Files</h2>
            <p className='text-muted-foreground'>
              Manage uploaded files and document processing.
            </p>
          </div>
        </div>
        <FilesTable search={search} navigate={navigate} />
      </Main>

      <FilesDialogs />
    </FilesProvider>
  )
}
