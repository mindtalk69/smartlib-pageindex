/**
 * Users Page - Main user management page
 *
 * Features:
 * - Displays user list with pagination (10 users per page)
 * - Search functionality by username or user_id
 * - User details dialog when clicking on a user
 * - Loading and error states
 * - Responsive layout
 */

import { useState } from 'react'
import { UsersPage } from '@/components/users/UsersPage'

export function Users() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Browse and manage all users in the system
        </p>
      </div>

      <UsersPage
        page={page}
        perPage={perPage}
        search={search}
        onPageChange={setPage}
        onSearchChange={setSearch}
      />
    </div>
  )
}
