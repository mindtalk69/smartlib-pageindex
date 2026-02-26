/**
 * PasswordResetRequestDialog Component - Dialog for viewing and managing password reset requests
 *
 * Features:
 * - Display complete request details
 * - Approve action with temp password display
 * - Deny action with admin notes input
 * - Copy to clipboard functionality
 * - Link to user profile
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PasswordResetRequest } from '@/hooks/usePasswordResetRequests'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface PasswordResetRequestDialogProps {
  request: PasswordResetRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (requestId: string) => Promise<void>
  onDeny: (requestId: string, notes?: string) => Promise<void>
}

export function PasswordResetRequestDialog({
  request,
  open,
  onOpenChange,
  onApprove,
  onDeny,
}: PasswordResetRequestDialogProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isDenying, setIsDenying] = useState(false)
  const [denyNotes, setDenyNotes] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleApprove = async () => {
    if (!request) return
    setIsApproving(true)
    try {
      await onApprove(request.id)
      // Temp password handling is done by parent via toast notification
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeny = async () => {
    if (!request) return
    setIsDenying(true)
    try {
      await onDeny(request.id, denyNotes)
      setDenyNotes('')
      onOpenChange(false)
    } finally {
      setIsDenying(false)
    }
  }

  const copyTempPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary'
      case 'approved':
        return 'default'
      case 'denied':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Password Reset Request</DialogTitle>
          <DialogDescription>
            Review and manage user password reset request
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Request ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Request ID</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={request.id} readOnly className="font-mono text-sm" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(request.id)
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(request.status)}>{request.status}</Badge>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username</Label>
              <div className="mt-1">
                <a
                  href={`/admin-app/users`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {request.username}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <div className="mt-1">
                <a href={`mailto:${request.email}`} className="text-primary hover:underline">
                  {request.email}
                </a>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label>Reason for Reset</Label>
            <div className="mt-1 p-3 rounded-md bg-muted">
              {request.reason || 'No reason provided'}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Requested At</Label>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDate(request.requested_at)}
              </div>
            </div>
            <div>
              <Label>Reviewed At</Label>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDate(request.reviewed_at)}
              </div>
            </div>
          </div>

          {/* Reviewed By */}
          {request.reviewed_by && (
            <div>
              <Label>Reviewed By</Label>
              <div className="mt-1 text-sm">{request.reviewed_by}</div>
            </div>
          )}

          {/* Admin Notes (for denied requests) */}
          {request.admin_notes && (
            <div>
              <Label>Admin Notes</Label>
              <div className="mt-1 p-3 rounded-md bg-muted text-sm">{request.admin_notes}</div>
            </div>
          )}

          {/* Temp Password (for approved requests) */}
          {request.temp_password && (
            <div>
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={request.temp_password}
                  readOnly
                  className="font-mono text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={copyTempPassword}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Display temp password after approval */}
          {tempPassword && (
            <div>
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={tempPassword} readOnly className="font-mono text-sm flex-1" />
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={copyTempPassword}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Password copied to clipboard
              </p>
            </div>
          )}

          {/* Action Section for Pending Requests */}
          {request.status === 'pending' && !tempPassword && (
            <>
              {isDenying ? (
                <div className="space-y-2">
                  <Label>Deny Request - Admin Notes</Label>
                  <Textarea
                    value={denyNotes}
                    onChange={(e) => setDenyNotes(e.target.value)}
                    placeholder="Reason for denial (optional)"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDenying(false)
                        setDenyNotes('')
                      }}
                      disabled={isDenying}
                    >
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDeny} disabled={isDenying}>
                      Confirm Deny
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="flex-1"
                  >
                    {isApproving ? 'Approving...' : 'Approve Request'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDenying(true)}
                    disabled={isDenying}
                    className="flex-1"
                  >
                    Deny Request
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
