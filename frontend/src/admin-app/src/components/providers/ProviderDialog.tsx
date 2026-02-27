/**
 * ProviderDialog Component - Dialog for add/edit provider
 *
 * Features:
 * - Form fields: Name, Provider Type, Base URL, API Key, Is Active, Is Default, Priority, Config
 * - Form validation (name and provider type required)
 * - Add mode (empty form) and Edit mode (pre-filled form)
 * - Provider type presets for base URL placeholders
 * - Test Connection button in edit mode
 */

import { useState, useEffect } from 'react'
import { LLMProvider } from '@/hooks/useProviders'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PlugZap, AlertCircle } from 'lucide-react'

export interface ProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: LLMProvider | null  // If provided, edit mode
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onAdd?: (provider: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>
  onUpdate?: (id: number, updates: Partial<LLMProvider>) => Promise<{ success: boolean; error?: string }>
  onTestConnection?: (id: number) => Promise<{ success: boolean; status?: string; error?: string }>
}

// Provider type options
const PROVIDER_TYPES = [
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'custom', label: 'Custom' },
]

// Base URL placeholders for each provider type
const BASE_URL_PLACEHOLDERS: Record<string, string> = {
  azure_openai: 'https://<resource>.openai.azure.com',
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  cohere: 'https://api.cohere.ai',
  huggingface: 'https://api-inference.huggingface.co',
  custom: 'https://api.example.com',
}

// Empty form state
const emptyForm: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  provider_type: 'openai',
  base_url: null,
  api_key: '',
  is_active: true,
  is_default: false,
  priority: 0,
  config: {},
  last_health_check: null,
  health_status: null,
  error_message: null,
}

/**
 * ProviderDialog component for add/edit provider
 */
export function ProviderDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
  onError,
  onAdd,
  onUpdate,
  onTestConnection,
}: ProviderDialogProps) {
  const [formData, setFormData] = useState<Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditMode = !!provider

  // Reset form when dialog opens/closes or provider changes
  useEffect(() => {
    if (open) {
      if (provider) {
        // Edit mode - pre-fill form
        setFormData({
          name: provider.name,
          provider_type: provider.provider_type,
          base_url: provider.base_url,
          api_key: '',  // Don't pre-fill API key for security
          is_active: provider.is_active,
          is_default: provider.is_default,
          priority: provider.priority,
          config: provider.config || {},
          last_health_check: provider.last_health_check,
          health_status: provider.health_status,
          error_message: provider.error_message,
        })
      } else {
        // Add mode - empty form
        setFormData(emptyForm)
      }
      setErrors({})
    }
  }, [open, provider])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.provider_type.trim()) {
      newErrors.provider_type = 'Provider type is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      const submitData = { ...formData }

      // Remove empty config
      if (Object.keys(submitData.config).length === 0) {
        delete submitData.config
      }

      // Remove empty API key in edit mode (don't overwrite existing)
      if (isEditMode && !submitData.api_key) {
        delete submitData.api_key
      }

      if (isEditMode && provider) {
        const result = await onUpdate?.(provider.id, submitData)
        if (result?.success) {
          onSuccess?.(isEditMode ? 'Provider updated successfully' : 'Provider added successfully')
          onOpenChange(false)
        } else {
          onError?.(result?.error || 'Failed to update provider')
        }
      } else {
        const result = await onAdd?.(submitData)
        if (result?.success) {
          onSuccess?.('Provider added successfully')
          onOpenChange(false)
        } else {
          onError?.(result?.error || 'Failed to add provider')
        }
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to save provider')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!provider?.id) return

    setTestingConnection(true)
    try {
      const result = await onTestConnection?.(provider.id)
      if (result?.success) {
        onSuccess?.(`Connection test: ${result.status || 'successful'}`)
      } else {
        onError?.(result?.error || 'Connection test failed')
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleConfigChange = (value: string) => {
    try {
      if (value.trim() === '') {
        setFormData((prev) => ({ ...prev, config: {} }))
      } else {
        const parsed = JSON.parse(value)
        setFormData((prev) => ({ ...prev, config: parsed }))
      }
    } catch {
      // Invalid JSON, don't update
    }
  }

  const getConfigJson = () => {
    if (!formData.config || Object.keys(formData.config).length === 0) {
      return ''
    }
    return JSON.stringify(formData.config, null, 2)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Provider' : 'Add Provider'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My OpenAI Provider"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Provider Type */}
          <div className="grid gap-2">
            <Label htmlFor="provider_type">Provider Type *</Label>
            <Select
              value={formData.provider_type}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, provider_type: value }))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider type" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.provider_type && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.provider_type}
              </p>
            )}
          </div>

          {/* Base URL */}
          <div className="grid gap-2">
            <Label htmlFor="base_url">Base URL</Label>
            <Input
              id="base_url"
              value={formData.base_url || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value || null }))}
              placeholder={BASE_URL_PLACEHOLDERS[formData.provider_type] || 'https://api.example.com'}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Uses default for {PROVIDER_TYPES.find((t) => t.value === formData.provider_type)?.label || 'provider'} if not specified.
            </p>
          </div>

          {/* API Key */}
          <div className="grid gap-2">
            <Label htmlFor="api_key">API Key {isEditMode && '(leave blank to keep existing)'}</Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
              placeholder="sk-..."
              disabled={isSubmitting}
            />
            {isEditMode && !formData.api_key && (
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the existing API key
              </p>
            )}
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              disabled={isSubmitting}
              className="h-4 w-4"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (provider can be used for requests)
            </Label>
          </div>

          {/* Is Default */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={formData.is_default}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_default: e.target.checked }))}
              disabled={isSubmitting}
              className="h-4 w-4"
            />
            <Label htmlFor="is_default" className="cursor-pointer">
              Default (used when no specific provider is selected)
            </Label>
            {formData.is_default && (
              <Badge variant="default" className="ml-2">Only one default allowed</Badge>
            )}
          </div>

          {/* Priority */}
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value, 10) || 0 }))}
              min={0}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers = higher priority. Providers are sorted by priority.
            </p>
          </div>

          {/* Config (JSON) */}
          <div className="grid gap-2">
            <Label htmlFor="config">Advanced Config (JSON)</Label>
            <Textarea
              id="config"
              value={getConfigJson()}
              onChange={(e) => handleConfigChange(e.target.value)}
              placeholder='{"temperature": 0.7, "max_tokens": 1000}'
              className="font-mono text-sm min-h-[100px]"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Optional advanced configuration in JSON format
            </p>
          </div>

          {/* Health Status (edit mode only) */}
          {isEditMode && provider?.health_status && (
            <div className="grid gap-2 p-3 rounded-md bg-muted">
              <Label>Health Status</Label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    provider.health_status === 'healthy'
                      ? 'outline'
                      : provider.health_status === 'degraded'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {provider.health_status}
                </Badge>
                {provider.last_health_check && (
                  <span className="text-xs text-muted-foreground">
                    Last checked: {new Date(provider.last_health_check).toLocaleString()}
                  </span>
                )}
              </div>
              {provider.error_message && (
                <p className="text-xs text-destructive">{provider.error_message}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEditMode && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || isSubmitting}
              type="button"
            >
              <PlugZap className="mr-2 h-4 w-4" />
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Add Provider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
