/**
 * Dashboard - Main admin dashboard page
 *
 * Features:
 * - Displays system statistics (users, files, messages, libraries)
 * - Interactive charts with view switching
 * - User activity table showing top users
 * - Real-time refresh capability
 * - Loading and error states
 * - Responsive design
 */

import { useDashboardData } from "@/hooks/useDashboardData"
import { StatCard } from "@/components/dashboard/StatCard"
import { ChartSection } from "@/components/dashboard/ChartSection"
import { UserStatsTable, type UserStats } from "@/components/dashboard/UserStatsTable"
import { Users, FileText, MessageSquare, Database } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/**
 * Dashboard page component
 */
export function Dashboard() {
    const { stats, isLoading, error, refreshStats } = useDashboardData()

    // Mock user stats data - will be replaced with real API data in future iterations
    const mockUserStats: UserStats[] = [
        {
            user_id: "1",
            username: "admin",
            email: "admin@example.com",
            file_count: 45,
            message_count: 234,
            library_count: 8,
            last_activity: new Date().toISOString()
        },
        {
            user_id: "2",
            username: "researcher",
            email: "researcher@example.com",
            file_count: 32,
            message_count: 189,
            library_count: 5,
            last_activity: new Date(Date.now() - 86400000).toISOString()
        },
        {
            user_id: "3",
            username: "student",
            email: "student@example.com",
            file_count: 18,
            message_count: 156,
            library_count: 3,
            last_activity: new Date(Date.now() - 172800000).toISOString()
        }
    ]

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <Button disabled>
                        <span className="animate-spin mr-2">⟳</span> Loading...
                    </Button>
                </div>

                {/* Skeleton stat cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
                            <div className="h-10 bg-muted rounded mb-2" />
                            <div className="h-4 bg-muted rounded w-24 mb-1" />
                            <div className="h-3 bg-muted rounded w-16" />
                        </div>
                    ))}
                </div>

                {/* Skeleton chart section */}
                <div className="rounded-lg border bg-card p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-32 mb-4" />
                    <div className="h-64 bg-muted rounded" />
                </div>

                {/* Skeleton table */}
                <div className="rounded-lg border bg-card p-6 animate-pulse">
                    <div className="h-6 bg-muted rounded w-48 mb-4" />
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-10 bg-muted rounded" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <Button onClick={refreshStats}>
                        <span className="mr-2">⟳</span> Retry
                    </Button>
                </div>

                <Alert variant="destructive">
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with refresh button */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Button onClick={refreshStats} disabled={isLoading}>
                    <span className="mr-2">⟳</span> Refresh
                </Button>
            </div>

            {/* Stats Cards Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Users"
                    value={stats?.user_count ?? 0}
                    icon={<Users className="h-6 w-6" />}
                    description="Registered accounts"
                />
                <StatCard
                    title="Total Files"
                    value={stats?.file_count ?? 0}
                    icon={<FileText className="h-6 w-6" />}
                    description="Uploaded documents"
                />
                <StatCard
                    title="Total Messages"
                    value={stats?.message_count ?? 0}
                    icon={<MessageSquare className="h-6 w-6" />}
                    description="Chat conversations"
                />
                <StatCard
                    title="Libraries"
                    value={stats?.library_count ?? 0}
                    icon={<Database className="h-6 w-6" />}
                    description="Document collections"
                />
            </div>

            {/* Charts Section */}
            <ChartSection onRefresh={refreshStats} />

            {/* User Stats Table */}
            <UserStatsTable users={mockUserStats} />
        </div>
    )
}
