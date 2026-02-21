'use client'

import { getRouteApi } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { GroupsTable } from './components/groups-table'
import { GroupsProvider } from './components/groups-provider'
import { GroupsDialogs } from './components/groups-dialogs'
import { GroupsPrimaryButtons } from './components/groups-primary-buttons'

const route = getRouteApi('/_authenticated/groups/')

export function Groups() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <GroupsProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>User Groups</h2>
            <p className='text-muted-foreground'>
              Manage user groups and access control.
            </p>
          </div>
          <GroupsPrimaryButtons />
        </div>
        <GroupsTable search={search} navigate={navigate} />
      </Main>

      <GroupsDialogs />
    </GroupsProvider>
  )
}
