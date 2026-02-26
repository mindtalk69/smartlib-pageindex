/**
 * PasswordResetRequestsList Component - Password reset request list with status filtering
 *
 * Features:
 * - Status filter tabs (Pending, Approved, Denied, All)
 * - Table with request details
 * - Status badges with color coding
 * - Inline approve/deny actions for pending requests
 * - Row click to open details dialog
 * - Sorting by column
 */

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PasswordResetRequest } from '@/hooks/usePasswordResetRequests'

interface PasswordResetRequestsListProps {
  requests: PasswordResetRequest[]
  statusFilter: 'pending' | 'approved' | 'denied' | 'all'
  onStatusChange: (status: 'pending' | 'approved' | 'denied' | 'all') => void
  onSelectRequest: (request: PasswordResetRequest) => void
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  isLoading: boolean
  error: string | null
}

type SortField = 'username' | 'email' | 'requested_at' | 'status'
type SortDirection = 'asc' | 'desc'

export function PasswordResetRequestsList({
  requests,
  statusFilter,
  onStatusChange,
  onSelectRequest,
  onApprove,
  onDeny,
  isLoading,
  error,
}: PasswordResetRequestsListProps) {
  const [sortField, setSortField] = useState<SortField>('requested_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const statusTabs: { value: 'pending' | 'approved' | 'denied' | 'all'; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
    { value: 'all', label: 'All' },
  ]

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary' // yellow/orange
      case 'approved':
        return 'default' // green
      case 'denied':
        return 'destructive' // red
      default:
        return 'outline'
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedRequests = [...requests].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'username':
        comparison = a.username.localeCompare(b.username)
        break
      case 'email':
        comparison = a.email.localeCompare(b.email)
        break
      case 'requested_at':
        comparison = new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">{error}</div>
  }

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusChange(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2',
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('username')}
              >
                Username
                {sortField === 'username' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                Email
                {sortField === 'email' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead className="max-w-[200px]">Reason</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('requested_at')}
              >
                Requested
                {sortField === 'requested_at' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                Status
                {sortField === 'status' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              <TableHead>Reviewed By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No password reset requests
                </TableCell>
              </TableRow>
            ) : (
              sortedRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectRequest(request)}
                >
                  <TableCell className="font-medium">{request.username}</TableCell>
                  <TableCell>{request.email}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={request.reason}>
                    {request.reason}
                  </TableCell>
                  <TableCell>{formatDate(request.requested_at)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{request.reviewed_by || '-'}</TableCell>
                  <TableCell className="text-right">
                    {request.status === 'pending' && (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8"
                          onClick={() => onApprove(request.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => onDeny(request.id)}
                        >
                          Deny
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
