/**
 * useDashboardData - Custom hook for fetching dashboard statistics
 *
 * Features:
 * - Fetches stats from GET /api/v1/admin/stats on mount
 * - Provides refreshStats function for manual refresh
 * - Tracks loading and error states
 * - Returns stats data
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

/**
 * Dashboard statistics interface matching API response
 */
export interface DashboardStats {
    user_count: number
    file_count: number
    message_count: number
    library_count: number
    knowledge_count: number
    [key: string]: number | string
}

/**
 * Hook return type
 */
interface UseDashboardDataReturn {
    stats: DashboardStats | null
    isLoading: boolean
    error: string | null
    refreshStats: () => Promise<void>
}

/**
 * Custom hook for dashboard data management
 */
export function useDashboardData(): UseDashboardDataReturn {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await api.get<DashboardStats>('/api/v1/admin/stats')
            setStats(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stats')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return { stats, isLoading, error, refreshStats: fetchStats }
}
