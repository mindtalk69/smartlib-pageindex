/**
 * UserStatsTable - User statistics table component for dashboard
 *
 * Features:
 * - Displays top 10 most active users by activity
 * - Shows username, files uploaded, messages sent, libraries used, last activity
 * - Sortable columns by clicking headers
 * - "View all" link to Users page
 * - Empty state when no data available
 * - Responsive design for mobile
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ChevronRight } from "lucide-react"

/**
 * User statistics data interface
 */
export interface UserStats {
    user_id: string
    username: string
    email: string
    file_count: number
    message_count: number
    library_count: number
    last_activity: string
}

/**
 * UserStatsTable component props
 */
export interface UserStatsTableProps {
    /** Optional users data - if not provided, shows empty state */
    users?: UserStats[]
    /** Maximum number of users to display (default: 10) */
    limit?: number
}

/**
 * Sort configuration type
 */
type SortField = 'username' | 'file_count' | 'message_count' | 'library_count' | 'last_activity'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
    field: SortField
    direction: SortDirection
}

/**
 * UserStatsTable component displaying top users by activity
 */
export function UserStatsTable({ users, limit = 10 }: UserStatsTableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        field: 'message_count',
        direction: 'desc'
    })

    // Sort users based on current sort configuration
    const sortedUsers = users ? [...users].sort((a, b) => {
        const aValue = a[sortConfig.field]
        const bValue = b[sortConfig.field]

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
    }) : []

    // Get top users based on limit
    const displayedUsers = sortedUsers.slice(0, limit)

    // Handle column header click for sorting
    const handleSort = (field: SortField) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
        }))
    }

    // Render sort icon based on current sort state
    const renderSortIcon = (field: SortField) => {
        if (sortConfig.field !== field) return null
        return (
            <ArrowUpDown className="ml-2 h-4 w-4 inline" />
        )
    }

    // Format date for display
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        } catch {
            return dateString
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Top Users by Activity</h2>
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/users" className="flex items-center gap-1">
                        View all <ChevronRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                {displayedUsers.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort('username')}>
                                    Username {renderSortIcon('username')}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/80 text-right" onClick={() => handleSort('file_count')}>
                                    Files {renderSortIcon('file_count')}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/80 text-right" onClick={() => handleSort('message_count')}>
                                    Messages {renderSortIcon('message_count')}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/80 text-right" onClick={() => handleSort('library_count')}>
                                    Libraries {renderSortIcon('library_count')}
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-muted/80" onClick={() => handleSort('last_activity')}>
                                    Last Activity {renderSortIcon('last_activity')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedUsers.map((user) => (
                                <TableRow key={user.user_id} className="hover:bg-muted/30">
                                    <TableCell className="font-medium">
                                        <div>
                                            <div className="font-medium">{user.username}</div>
                                            <div className="text-xs text-muted-foreground">{user.email}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{user.file_count.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{user.message_count.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{user.library_count.toLocaleString()}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(user.last_activity)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-muted-foreground text-sm">No user data available</p>
                    </div>
                )}
            </div>
        </div>
    )
}
