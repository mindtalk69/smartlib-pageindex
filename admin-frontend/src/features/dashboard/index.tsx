'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageSquare, Users, FolderOpen, Library } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardStats {
  user_count: number
  file_count: number
  knowledge_count: number
  library_count: number
  message_count: number
  recent_files: Array<{
    id: string
    filename: string
    created_at: string
  }>
  recent_messages: Array<{
    id: string
    question: string
    created_at: string
  }>
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/admin/api/dashboard/stats')
        const data = await response.json()
        if (data.success) {
          setStats(data.data)
        } else {
          setError(data.error || 'Failed to fetch stats')
        }
      } catch (err) {
        setError('Failed to connect to server')
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.user_count ?? 0,
      icon: Users,
      description: 'Active users',
    },
    {
      title: 'Total Files',
      value: stats?.file_count ?? 0,
      icon: FileText,
      description: 'Uploaded documents',
    },
    {
      title: 'Knowledges',
      value: stats?.knowledge_count ?? 0,
      icon: FolderOpen,
      description: 'Knowledge bases',
    },
    {
      title: 'Libraries',
      value: stats?.library_count ?? 0,
      icon: Library,
      description: 'Document libraries',
    },
  ]

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

      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-muted-foreground'>
              SmartLib system overview and statistics
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Refresh</Button>
        </div>

        <Tabs defaultValue='overview' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='space-y-4'>
            {isLoading ? (
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <Skeleton className='h-4 w-[100px]' />
                      <Skeleton className='h-4 w-4' />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className='h-8 w-[60px] mb-2' />
                      <Skeleton className='h-3 w-[120px]' />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card>
                <CardContent className='pt-6'>
                  <p className='text-destructive text-center'>{error}</p>
                </CardContent>
              </Card>
            ) : (
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                {statCards.map((stat) => (
                  <Card key={stat.title}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <CardTitle className='text-sm font-medium'>
                        {stat.title}
                      </CardTitle>
                      <stat.icon className='h-4 w-4 text-muted-foreground' />
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold'>{stat.value}</div>
                      <p className='text-xs text-muted-foreground'>
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Files</CardTitle>
                  <CardDescription>
                    Latest uploaded documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className='space-y-4'>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full' />
                      ))}
                    </div>
                  ) : stats?.recent_files.length ? (
                    <ul className='space-y-3'>
                      {stats.recent_files.map((file) => (
                        <li
                          key={file.id}
                          className='flex items-center justify-between'
                        >
                          <div className='flex items-center gap-2'>
                            <FileText className='h-4 w-4 text-muted-foreground' />
                            <span className='text-sm font-medium'>
                              {file.filename}
                            </span>
                          </div>
                          <span className='text-xs text-muted-foreground'>
                            {new Date(file.created_at).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className='text-center text-muted-foreground py-4'>
                      No recent files
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Messages</CardTitle>
                  <CardDescription>
                    Latest user queries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className='space-y-4'>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full' />
                      ))}
                    </div>
                  ) : stats?.recent_messages.length ? (
                    <ul className='space-y-3'>
                      {stats.recent_messages.map((msg) => (
                        <li
                          key={msg.id}
                          className='flex flex-col gap-1 border-b pb-2 last:border-0'
                        >
                          <div className='flex items-center gap-2'>
                            <MessageSquare className='h-4 w-4 text-muted-foreground' />
                            <span className='text-sm font-medium'>
                              {msg.question?.substring(0, 80) || 'No question'}
                              {msg.question && msg.question.length > 80 && '...'}
                            </span>
                          </div>
                          <span className='text-xs text-muted-foreground'>
                            {new Date(msg.created_at).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className='text-center text-muted-foreground py-4'>
                      No recent messages
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value='activity' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  System activity will be shown here
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-center text-muted-foreground py-8'>
                  Activity log coming soon...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
