'use client'

import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ResetRequestsDialogs } from './components/reset-requests-dialogs'
import { ResetRequestsPrimaryButtons } from './components/reset-requests-primary-buttons'
import { ResetRequestsProvider } from './components/reset-requests-provider'
import { ResetRequestsTable } from './components/reset-requests-table'

const route = getRouteApi('/_authenticated/reset-requests/')

export function ResetRequestsPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <ResetRequestsProvider search={search} navigate={navigate}>
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
            <h2 className='text-2xl font-bold tracking-tight'>Password Reset Requests</h2>
            <p className='text-muted-foreground'>
              Review and manage user password reset requests here.
            </p>
          </div>
          <ResetRequestsPrimaryButtons />
        </div>
        <ResetRequestsTable search={search} navigate={navigate} />
      </Main>

      <ResetRequestsDialogs />
    </ResetRequestsProvider>
  )
}
