/**
 * PasswordResetRequests Page - Main password reset requests management page
 *
 * Features:
 * - Status filtering (pending/approved/denied/all)
 * - Request list with actions
 * - Details dialog
 * - Toast notifications for actions
 */

import { useState } from 'react'
import { usePasswordResetRequests, type PasswordResetRequest } from '@/hooks/usePasswordResetRequests'
import { PasswordResetRequestsList } from '@/components/users/PasswordResetRequests'
import { PasswordResetRequestDialog } from '@/components/users/PasswordResetRequestDialog'
import { toast } from 'sonner'

type StatusFilter = 'pending' | 'approved' | 'denied' | 'all'

export function PasswordResetRequests() {
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')

  const { requests, isLoading, error, refresh, actions } = usePasswordResetRequests({
    status: statusFilter,
  })

  const handleApprove = async (requestId: string) => {
    const result = await actions.approve(requestId)
    if (result.success) {
      toast.success('Password reset approved', {
        description: result.tempPassword
          ? `Temporary password: ${result.tempPassword} (copied to clipboard)`
          : 'Request approved successfully',
      })
      refresh()
    } else {
      toast.error('Failed to approve request', {
        description: result.error || 'An error occurred',
      })
    }
  }

  const handleDeny = async (requestId: string, notes?: string) => {
    const result = await actions.deny(requestId, notes || '')
    if (result.success) {
      toast.success('Request denied')
      refresh()
    } else {
      toast.error('Failed to deny request', {
        description: result.error || 'An error occurred',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Password Reset Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage user password reset requests
        </p>
      </div>

      <PasswordResetRequestsList
        requests={requests}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onSelectRequest={setSelectedRequest}
        onApprove={handleApprove}
        onDeny={handleDeny}
        isLoading={isLoading}
        error={error}
      />

      <PasswordResetRequestDialog
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </div>
  )
}
