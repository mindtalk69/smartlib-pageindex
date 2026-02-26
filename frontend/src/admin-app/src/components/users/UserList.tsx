/**
 * UserList Component - User list table with pagination and search
 *
 * Features:
 * - Table display with 6 columns (Username, Email, Role, Status, Created, Actions)
 * - Pagination controls (prev/next, page numbers, page size selector)
 * - Search input with debounced filtering
 * - Row click to view user details
 * - Status badges for role and active/disabled
 * - Actions dropdown menu with quick operations
 */

import { useState, useEffect, useCallback } from 'react'
import { User } from '@/hooks/useUsers'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Shield,
  UserCheck,
  Key,
  Trash2,
} from 'lucide-react'

export interface UserListProps {
  users: User[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
  search: string
  onSearchChange: (search: string) => void
  onPageChange: (page: number) => void
  onUserSelect: (user: User) => void
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onNextPage: () => void
  onPrevPage: () => void
  onToggleAdmin?: (userId: string) => Promise<void>
  onToggleActive?: (userId: string) => Promise<void>
  onResetPassword?: (userId: string) => Promise<{ tempPassword: string }>
  onDeleteUser?: (userId: string) => Promise<void>
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

/**
 * UserList component with table, pagination, and search
 */
export function UserList({
  users,
  pagination,
  search,
  onSearchChange,
  onPageChange,
  onUserSelect,
  isLoading,
  error,
  onRefresh,
  onNextPage,
  onPrevPage,
}: UserListProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debouncedSearch = useDebounce(localSearch, 300)

  // Sync local search with parent when debounced value changes
  useEffect(() => {
    onSearchChange(debouncedSearch)
  }, [debouncedSearch, onSearchChange])

  // Update local search when parent search changes
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const handleClearSearch = useCallback(() => {
    setLocalSearch('')
    onSearchChange('')
  }, [onSearchChange])

  const { page, totalPages, perPage, total } = pagination

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or user_id..."
              className="pl-10"
              disabled
            />
          </div>
        </div>
        <div className="border rounded-md">
          <div className="p-8 text-center text-muted-foreground">
            Loading users...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or user_id..."
              className="pl-10"
              disabled
            />
          </div>
        </div>
        <div className="border rounded-md p-4 bg-destructive/10 text-destructive">
          <p className="font-medium">Error loading users</p>
          <p className="text-sm mt-1">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or user_id..."
            className="pl-10 pr-10"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of {total} users
        </div>
      </div>

      {/* User table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]">Role</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[150px]">Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Search className="h-8 w-8 mb-2" />
                    <p>No users found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onUserSelect(user)}
                >
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_disabled ? 'destructive' : 'outline'}>
                      {user.is_disabled ? 'Disabled' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUserSelect(user)
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleAdmin?.(user.id)
                              .then(() => onSuccess?.(user.is_admin ? 'Admin rights revoked' : 'Admin rights granted'))
                              .catch(() => onError?.('Failed to update admin status'))
                          }}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {user.is_admin ? 'Revoke admin' : 'Make admin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleActive?.(user.id)
                              .then(() => onSuccess?.(user.is_disabled ? 'User enabled' : 'User disabled'))
                              .catch(() => onError?.('Failed to update user status'))
                          }}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          {user.is_disabled ? 'Enable user' : 'Disable user'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onResetPassword?.(user.id)
                              .then((result) => {
                                if (result?.tempPassword) {
                                  navigator.clipboard.writeText(result.tempPassword)
                                  onSuccess?.(`Password reset. Temp: ${result.tempPassword}`)
                                }
                              })
                              .catch(() => onError?.('Failed to reset password'))
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            // For delete, we still open the dialog for safety
                            onUserSelect(user)
                          }}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select value={String(perPage)} onValueChange={() => {}}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevPage}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
