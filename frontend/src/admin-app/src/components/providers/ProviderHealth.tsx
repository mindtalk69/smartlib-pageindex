/**
 * ProviderHealth Component - Health status display and manual check trigger
 *
 * Features:
 * - Health status badge (healthy/degraded/offline/unknown)
 * - Last health check timestamp in relative time
 * - Error message display
 * - Manual health check button
 * - Compact view for table cells
 * - Expanded view on hover/click
 */

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import { useProviderHealth, HealthStatus } from '@/hooks/useProviderHealth'

export interface ProviderHealthProps {
  providerId: number
  initialHealth?: {
    status: string | null
    lastHealthCheck: string | null
    errorMessage: string | null
  }
  onHealthCheck?: (providerId: number) => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never checked'

  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * Get health status badge configuration
 */
function getHealthBadgeConfig(status: string | undefined | null) {
  switch (status) {
    case 'healthy':
      return {
        variant: 'outline' as const,
        icon: CheckCircle,
        color: 'text-green-600 dark:text-green-400',
        label: 'Healthy',
      }
    case 'degraded':
      return {
        variant: 'secondary' as const,
        icon: AlertTriangle,
        color: 'text-yellow-600 dark:text-yellow-400',
        label: 'Degraded',
      }
    case 'offline':
      return {
        variant: 'destructive' as const,
        icon: XCircle,
        color: 'text-red-600 dark:text-red-400',
        label: 'Offline',
      }
    default:
      return {
        variant: 'secondary' as const,
        icon: HelpCircle,
        color: 'text-gray-500 dark:text-gray-400',
        label: 'Unknown',
      }
  }
}

/**
 * ProviderHealth component with status badge and manual check
 */
export function ProviderHealth({
  providerId,
  initialHealth,
  onHealthCheck,
  onSuccess,
  onError,
}: ProviderHealthProps) {
  const { checkHealth, getHealthStatus, isChecking } = useProviderHealth()
  const [expanded, setExpanded] = useState(false)

  // Get current health status (from hook or initial)
  const healthStatus = getHealthStatus(providerId)

  // Use initial health if no status from hook yet
  const displayStatus: HealthStatus = healthStatus || {
    status: (initialHealth?.status as HealthStatus['status']) || 'unknown',
    lastHealthCheck: initialHealth?.lastHealthCheck || null,
    errorMessage: initialHealth?.errorMessage || null,
  }

  const badgeConfig = getHealthBadgeConfig(displayStatus.status)
  const HealthIcon = badgeConfig.icon
  const checking = isChecking(providerId)

  // Handle manual health check
  const handleCheckHealth = useCallback(async () => {
    if (checking) return

    try {
      await checkHealth(providerId)
      onSuccess?.('Health check completed')
      onHealthCheck?.(providerId)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Health check failed'
      onError?.(errorMsg)
    }
  }, [providerId, checking, checkHealth, onHealthCheck, onSuccess, onError])

  return (
    <TooltipProvider>
      <Tooltip open={expanded && !checking}>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
          >
            {/* Health status badge */}
            <Badge
              variant={badgeConfig.variant}
              className={`flex items-center gap-1 ${badgeConfig.color}`}
            >
              <HealthIcon className="h-3 w-3" />
              <span className="text-xs">{badgeConfig.label}</span>
            </Badge>

            {/* Manual health check button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCheckHealth}
              disabled={checking}
            >
              <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
              <span className="sr-only">Check health</span>
            </Button>
          </div>
        </TooltipTrigger>

        {/* Expanded tooltip with details */}
        <TooltipContent side="right" align="start" className="max-w-[280px]">
          <div className="space-y-2">
            <div className="font-medium">{badgeConfig.label}</div>

            {/* Last check timestamp */}
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Last checked:</span>{' '}
              {formatRelativeTime(displayStatus.lastHealthCheck)}
            </div>

            {/* Response time if available */}
            {displayStatus.responseTime !== undefined && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Response time:</span>{' '}
                {displayStatus.responseTime}ms
              </div>
            )}

            {/* Error message */}
            {displayStatus.errorMessage && (
              <div className="text-xs text-destructive break-words">
                <span className="font-medium">Error:</span>{' '}
                {displayStatus.errorMessage.length > 100
                  ? `${displayStatus.errorMessage.substring(0, 100)}...`
                  : displayStatus.errorMessage}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
