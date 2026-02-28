'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguagesTable } from './components/languages-table'
import { LanguagesProvider } from './components/languages-provider'
import { LanguagesDialogs } from './components/languages-dialogs'
import { LanguagesPrimaryButtons } from './components/languages-primary-buttons'

const route = getRouteApi('/_authenticated/languages/')

export function Languages() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <LanguagesProvider search={search} navigate={navigate}>
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
            <h2 className='text-2xl font-bold tracking-tight'>LLM Languages</h2>
            <p className='text-muted-foreground'>
              Manage supported languages for LLM responses.
            </p>
          </div>
          <LanguagesPrimaryButtons />
        </div>
        <LanguagesTable search={search} navigate={navigate} />
      </Main>

      <LanguagesDialogs />
    </LanguagesProvider>
  )
}
