/**
 * ModelList Component - Model configuration list table with actions
 *
 * Features:
 * - Table display with columns: Name, Deployment Name, Provider, Temperature, Streaming, Is Default, Is Multimodal, Actions
 * - Provider filter dropdown
 * - Action dropdown menu: Edit, Set as Default, Set as Multimodal, Delete
 * - Badges for default (blue), multimodal (purple), streaming (green)
 * - Temperature color coding: low (green), medium (yellow), high (red)
 * - Empty state with "Add Model" button
 */

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
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
  Star,
  Image as ImageIcon,
  Trash2,
  Play,
  Search,
} from 'lucide-react'
import { ModelConfig } from '@/hooks/useModels'
import { LLMProvider } from '@/hooks/useProviders'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ModelListProps {
  models: ModelConfig[]
  providers: LLMProvider[]
  onEdit: (model: ModelConfig) => void
  onDelete: (id: number) => void
  onSetDefault: (id: number) => void
  onSetMultimodal: (id: number) => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

/**
 * Get temperature color based on value
 */
function getTemperatureColor(temp: number | null): string {
  if (temp === null) return 'text-muted-foreground'
  if (temp <= 0.3) return 'text-green-600'
  if (temp <= 0.7) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Get temperature badge variant
 */
function getTemperatureBadgeVariant(temp: number | null): 'outline' | 'secondary' | 'default' {
  if (temp === null) return 'secondary'
  if (temp <= 0.3) return 'outline' // green-ish
  if (temp <= 0.7) return 'secondary' // yellow-ish
  return 'default' // red-ish
}

/**
 * ModelList component with table and actions
 */
export function ModelList({
  models,
  providers,
  onEdit,
  onDelete,
  onSetDefault,
  onSetMultimodal,
  onSuccess,
  onError,
  isLoading,
  error,
  onRefresh,
}: ModelListProps) {
  const [providerFilter, setProviderFilter] = useState<string>('all')

  // Filter models by provider
  const filteredModels = providerFilter === 'all'
    ? models
    : models.filter(model => model.provider_id?.toString() === providerFilter)

  if (isLoading) {
    return (
      <div className="border rounded-md">
        <div className="p-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            Loading models...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-md p-4 bg-destructive/10 text-destructive">
        <p className="font-medium">Error loading models</p>
        <p className="text-sm mt-1">{error}</p>
        <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
          Retry
        </Button>
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="border rounded-md p-8 text-center">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <Search className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No models configured</p>
          <p className="text-sm mt-1">Add your first model to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Provider Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by provider:</span>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map(provider => (
              <SelectItem key={provider.id} value={provider.id.toString()}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Models Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[200px]">Deployment Name</TableHead>
              <TableHead className="w-[150px]">Provider</TableHead>
              <TableHead className="w-[120px]">Temperature</TableHead>
              <TableHead className="w-[100px]">Streaming</TableHead>
              <TableHead className="w-[120px]">Default</TableHead>
              <TableHead className="w-[120px]">Multimodal</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModels.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    {model.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={model.description}>
                        {model.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm font-mono">
                  {model.deployment_name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{model.provider_obj?.name || model.provider}</span>
                    <Badge variant="outline" className="text-xs">
                      {model.provider_obj?.provider_type || model.provider}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getTemperatureBadgeVariant(model.temperature)}>
                    <span className={getTemperatureColor(model.temperature)}>
                      {model.temperature !== null ? model.temperature.toFixed(1) : 'N/A'}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell>
                  {model.streaming ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Play className="h-3 w-3 mr-1" />
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {model.is_default ? (
                    <Badge variant="default" className="bg-blue-600">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {model.is_multimodal ? (
                    <Badge variant="default" className="bg-purple-600">
                      <ImageIcon className="h-3 w-3 mr-1" />
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
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
                        onClick={() => onEdit(model)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await onSetDefault(model.id)
                            onSuccess('Model set as default')
                          } catch {
                            onError('Failed to set as default')
                          }
                        }}
                      >
                        <Star className="mr-2 h-4 w-4" />
                        Set as Default
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          try {
                            await onSetMultimodal(model.id)
                            onSuccess('Model set as multimodal')
                          } catch {
                            onError('Failed to set as multimodal')
                          }
                        }}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Set as Multimodal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm(`Delete model: ${model.name}?`)) {
                            onDelete(model.id)
                          }
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
    </div>
  )
}
