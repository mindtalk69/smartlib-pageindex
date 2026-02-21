'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { KnowledgesTable } from './components/knowledges-table'
import { KnowledgesProvider } from './components/knowledges-provider'
import { KnowledgesDialogs } from './components/knowledges-dialogs'
import { KnowledgesPrimaryButtons } from './components/knowledges-primary-buttons'

const route = getRouteApi('/_authenticated/knowledges/')

export function Knowledges() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <KnowledgesProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>Knowledges</h2>
            <p className='text-muted-foreground'>
              Manage knowledge bases and document collections.
            </p>
          </div>
          <KnowledgesPrimaryButtons />
        </div>
        <KnowledgesTable search={search} navigate={navigate} />
      </Main>

      <KnowledgesDialogs />
    </KnowledgesProvider>
  )
}
