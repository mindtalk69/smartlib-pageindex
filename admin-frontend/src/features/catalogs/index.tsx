'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CatalogsTable } from './components/catalogs-table'
import { CatalogsProvider } from './components/catalogs-provider'
import { CatalogsDialogs } from './components/catalogs-dialogs'
import { CatalogsPrimaryButtons } from './components/catalogs-primary-buttons'

const route = getRouteApi('/_authenticated/catalogs/')

export function Catalogs() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <CatalogsProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>Catalogs</h2>
            <p className='text-muted-foreground'>
              Manage catalogs and categorization.
            </p>
          </div>
          <CatalogsPrimaryButtons />
        </div>
        <CatalogsTable search={search} navigate={navigate} />
      </Main>

      <CatalogsDialogs />
    </CatalogsProvider>
  )
}
