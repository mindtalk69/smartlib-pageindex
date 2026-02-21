'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CategoriesTable } from './components/categories-table'
import { CategoriesProvider } from './components/categories-provider'
import { CategoriesDialogs } from './components/categories-dialogs'
import { CategoriesPrimaryButtons } from './components/categories-primary-buttons'

const route = getRouteApi('/_authenticated/categories/')

export function Categories() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <CategoriesProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>Categories</h2>
            <p className='text-muted-foreground'>
              Manage categories for knowledge organization.
            </p>
          </div>
          <CategoriesPrimaryButtons />
        </div>
        <CategoriesTable search={search} navigate={navigate} />
      </Main>

      <CategoriesDialogs />
    </CategoriesProvider>
  )
}
