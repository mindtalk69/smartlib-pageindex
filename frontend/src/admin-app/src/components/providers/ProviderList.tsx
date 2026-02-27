/**
 * ProviderList Component - Provider list table with actions
 *
 * Features:
 * - Table display with columns: Name, Base URL, Status, Priority, Is Active, Is Default, Last Health Check, Actions
 * - Health status badges (green=healthy, yellow=degraded, red=offline, gray=unknown)
 * - Actions dropdown menu: Edit, Test Connection, Discover Models, Delete
 * - Priority input for reordering
 * - Empty state and loading state
 */

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Pencil,
  PlugZap,
  Search,
  Trash2,
} from 'lucide-react'
import { LLMProvider } from '@/hooks/useProviders'
import { ProviderHealth } from '@/components/providers/ProviderHealth'

export interface ProviderListProps {
  providers: LLMProvider[]
  onEdit: (provider: LLMProvider) => void
  onDelete: (id: number) => void
  onTestConnection: (id: number) => void
  onDiscoverModels: (id: number) => void
  onPriorityChange: (id: number, priority: number) => void
  onHealthCheck?: (providerId: number) => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

/**
 * Truncate long URLs
 */
function truncateUrl(url: string | null, maxLength = 40): string {
  if (!url) return '-'
  if (url.length <= maxLength) return url
  return `${url.substring(0, maxLength - 3)}...`
}

/**
 * ProviderList component with table and actions
 */
export function ProviderList({
  providers,
  onEdit,
  onDelete,
  onTestConnection,
  onDiscoverModels,
  onPriorityChange,
  onHealthCheck,
  onSuccess,
  onError,
  isLoading,
  error,
  onRefresh,
}: ProviderListProps) {
  if (isLoading) {
    return (
      <div className="border rounded-md">
        <div className="p-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            Loading providers...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-md p-4 bg-destructive/10 text-destructive">
        <p className="font-medium">Error loading providers</p>
        <p className="text-sm mt-1">{error}</p>
        <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
          Retry
        </Button>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <Search className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No providers configured</p>
          <p className="text-sm mt-1">Add your first LLM provider to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[250px]">Base URL</TableHead>
            <TableHead className="w-[150px]">Health Status</TableHead>
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[100px]">Active</TableHead>
            <TableHead className="w-[100px]">Default</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => (
            <TableRow key={provider.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{provider.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {provider.provider_type}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm font-mono">
                {truncateUrl(provider.base_url)}
              </TableCell>
              <TableCell>
                <ProviderHealth
                  providerId={provider.id}
                  initialHealth={{
                    status: provider.health_status,
                    lastHealthCheck: provider.last_health_check,
                    errorMessage: provider.error_message,
                  }}
                  onHealthCheck={onHealthCheck}
                  onSuccess={onSuccess}
                  onError={onError}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={provider.priority}
                  onChange={(e) => {
                    const newPriority = parseInt(e.target.value, 10)
                    if (!isNaN(newPriority)) {
                      onPriorityChange(provider.id, newPriority)
                    }
                  }}
                  className="w-20"
                  min={0}
                />
              </TableCell>
              <TableCell>
                <Badge variant={provider.is_active ? 'outline' : 'secondary'}>
                  {provider.is_active ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={provider.is_default ? 'default' : 'secondary'}>
                  {provider.is_default ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onEdit(provider)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onTestConnection(provider.id)
                          .then(() => onSuccess?.('Connection test completed'))
                          .catch(() => onError?.('Failed to test connection'))
                      }}
                    >
                      <PlugZap className="mr-2 h-4 w-4" />
                      Test Connection
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onDiscoverModels(provider.id)
                          .then(() => onSuccess?.('Models discovered'))
                          .catch(() => onError?.('Failed to discover models'))
                      }}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Discover Models
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        onDelete(provider.id)
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
