/**
 * useProviderHealth Hook - Provider health monitoring
 *
 * Features:
 * - Track health status per provider
 * - Check health function to trigger health check
 * - Auto-refresh health status on interval (optional)
 * - Return health status for specific provider
 */

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/apiClient'

/**
 * Health status interface
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline' | 'unknown'
  lastHealthCheck: string | null
  errorMessage: string | null
  responseTime?: number
}

/**
 * API response from health check endpoint
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'offline' | 'unknown'
  last_health_check?: string
  error?: string
  response_time?: number
  message?: string
}

/**
 * Hook return type
 */
export interface UseProviderHealthReturn {
  healthStatuses: Record<number, HealthStatus>
  checkHealth: (providerId: number) => Promise<HealthCheckResponse>
  getHealthStatus: (providerId: number) => HealthStatus | undefined
  isChecking: (providerId: number) => boolean
  clearHealthStatus: (providerId: number) => void
  clearAllHealthStatuses: () => void
}

/**
 * Custom hook for provider health monitoring
 */
export function useProviderHealth(): UseProviderHealthReturn {
  const [healthStatuses, setHealthStatuses] = useState<Record<number, HealthStatus>>({})
  const [checkingHealth, setCheckingHealth] = useState<Set<number>>(new Set())

  /**
   * Check health of a specific provider
   * Triggers the test connection API endpoint
   */
  const checkHealth = useCallback(async (providerId: number): Promise<HealthCheckResponse> => {
    setCheckingHealth(prev => new Set(prev).add(providerId))
    try {
      const result = await api.post<HealthCheckResponse>(`/api/v1/admin/providers/${providerId}/test`)

      setHealthStatuses(prev => ({
        ...prev,
        [providerId]: {
          status: result.status,
          lastHealthCheck: result.last_health_check || new Date().toISOString(),
          errorMessage: result.error || result.message || null,
          responseTime: result.response_time
        }
      }))

      return result
    } catch (error) {
      setHealthStatuses(prev => ({
        ...prev,
        [providerId]: {
          status: 'offline',
          lastHealthCheck: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : 'Health check failed'
        }
      }))
      throw error
    } finally {
      setCheckingHealth(prev => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }, [])

  /**
   * Get health status for a specific provider
   */
  const getHealthStatus = useCallback((providerId: number): HealthStatus | undefined => {
    return healthStatuses[providerId]
  }, [healthStatuses])

  /**
   * Check if health check is in progress for a provider
   */
  const isChecking = useCallback((providerId: number): boolean => {
    return checkingHealth.has(providerId)
  }, [checkingHealth])

  /**
   * Clear health status for a specific provider
   */
  const clearHealthStatus = useCallback((providerId: number) => {
    setHealthStatuses(prev => {
      const next = { ...prev }
      delete next[providerId]
      return next
    })
  }, [])

  /**
   * Clear all health statuses
   */
  const clearAllHealthStatuses = useCallback(() => {
    setHealthStatuses({})
  }, [])

  return {
    healthStatuses,
    checkHealth,
    getHealthStatus,
    isChecking,
    clearHealthStatus,
    clearAllHealthStatuses
  }
}
