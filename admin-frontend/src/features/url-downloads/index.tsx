'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Download, Link, CheckCircle, XCircle, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UrlDownload {
  id: number
  url: string
  library_name: string
  knowledge_name: string
  metadata_summary: string
  status: string
  content_type: string
  username: string
  processed_at: string
  is_ocr: boolean
  error_message?: string
}

export function UrlDownloads() {
  const [downloads, setDownloads] = useState<UrlDownload[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Fetch downloads on mount
  useEffect(() => {
    fetchDownloads()
  }, [])

  const fetchDownloads = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/downloads/')
      const data = await response.json()
      if (data.success || Array.isArray(data)) {
        setDownloads(Array.isArray(data) ? data : data.data || [])
      }
    } catch (error) {
      console.error('Error fetching downloads:', error)
      toast.error('Failed to load downloads')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this download record?')) return

    setDeleteId(id)
    try {
      const response = await fetch(`/api/admin/downloads/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (data.status === 'success') {
        toast.success('Download record deleted')
        fetchDownloads()
      } else {
        toast.error(data.message || 'Failed to delete')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete')
    } finally {
      setDeleteId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'success':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>
      case 'processing':
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case 'queued':
      case 'pending':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Queued</Badge>
      case 'failed':
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">URL Downloads</h2>
            <p className="text-muted-foreground">
              View and manage URL download history
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Download History</CardTitle>
            <CardDescription>View all URL downloads and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-muted-foreground p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2">Loading downloads...</p>
              </div>
            ) : downloads.length === 0 ? (
              <div className="text-center text-muted-foreground p-8">
                <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No URL downloads recorded yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Library / Knowledge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Content Type</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloads.map((download) => (
                    <TableRow key={download.id}>
                      <TableCell className="font-mono text-sm">#{download.id}</TableCell>
                      <TableCell>
                        <a
                          href={download.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline max-w-md block truncate"
                          title={download.url}
                        >
                          <Link className="inline h-3 w-3 mr-1" />
                          {download.url.substring(0, 60)}
                          {download.url.length > 60 && '...'}
                        </a>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{download.library_name || 'N/A'}</div>
                          {download.knowledge_name && (
                            <div className="text-muted-foreground text-xs">{download.knowledge_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(download.status)}
                        {download.error_message && (
                          <span className="text-muted-foreground text-xs block mt-1">
                            {download.error_message.substring(0, 50)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{download.content_type || 'N/A'}</TableCell>
                      <TableCell>
                        {download.processed_at
                          ? new Date(download.processed_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteId === download.id}
                          onClick={() => handleDelete(download.id)}
                        >
                          {deleteId === download.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
