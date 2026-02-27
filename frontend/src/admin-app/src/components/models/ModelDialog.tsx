/**
 * ModelDialog Component - Dialog for add/edit model configuration
 *
 * Features:
 * - Form fields: Name, Deployment Name, Provider, Temperature, Streaming, Description, Is Default, Is Multimodal
 * - Form validation (required fields, temperature range)
 * - Add mode (empty form) and Edit mode (pre-filled form)
 * - Deployment validation before submit
 * - Provider selection with active providers only
 * - Submit with loading state
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { ModelConfig } from '@/hooks/useModels'
import { LLMProvider } from '@/hooks/useProviders'

export interface ModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: LLMProvider[]
  model?: ModelConfig | null  // If provided, edit mode
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onAdd?: (model: Omit<ModelConfig, 'id' | 'created_at' | 'provider_obj'>) => Promise<void>
  onUpdate?: (id: number, updates: Partial<ModelConfig>) => Promise<void>
  onValidate?: (config: {
    deployment_name: string
    temperature: number | null
    streaming: boolean
    provider_id?: number
  }) => Promise<{ valid: boolean; message?: string }>
}

/**
 * ModelDialog component for add/edit operations
 */
export function ModelDialog({
  open,
  onOpenChange,
  providers,
  model,
  onSuccess,
  onError,
  onAdd,
  onUpdate,
  onValidate,
}: ModelDialogProps) {
  const isEditMode = !!model

  // Form state
  const [name, setName] = useState('')
  const [deploymentName, setDeploymentName] = useState('')
  const [providerId, setProviderId] = useState<string>('')
  const [temperature, setTemperature] = useState<number | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isMultimodal, setIsMultimodal] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message?: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens/closes or model changes
  useEffect(() => {
    if (open && model) {
      // Edit mode - pre-fill form
      setName(model.name || '')
      setDeploymentName(model.deployment_name || '')
      setProviderId(model.provider_id?.toString() || '')
      setTemperature(model.temperature)
      setStreaming(model.streaming || false)
      setDescription(model.description || '')
      setIsDefault(model.is_default || false)
      setIsMultimodal(model.is_multimodal || false)
    } else if (open) {
      // Add mode - reset form
      setName('')
      setDeploymentName('')
      setProviderId('')
      setTemperature(null)
      setStreaming(false)
      setDescription('')
      setIsDefault(false)
      setIsMultimodal(false)
    }
    setValidationResult(null)
    setErrors({})
  }, [open, model])

  /**
   * Validate form fields
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!deploymentName.trim()) {
      newErrors.deploymentName = 'Deployment name is required'
    }

    if (!providerId) {
      newErrors.provider = 'Provider is required'
    }

    if (temperature !== null && (temperature < 0 || temperature > 2)) {
      newErrors.temperature = 'Temperature must be between 0 and 2'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Validate deployment configuration
   */
  const handleValidateDeployment = async () => {
    if (!deploymentName || !providerId) {
      setValidationResult({ valid: false, message: 'Deployment name and provider are required' })
      return
    }

    setIsValidating(true)
    setValidationResult(null)

    try {
      if (onValidate) {
        const result = await onValidate({
          deployment_name: deploymentName,
          temperature,
          streaming,
          provider_id: parseInt(providerId, 10),
        })
        setValidationResult(result)
      } else {
        // If no validate function provided, assume valid
        setValidationResult({ valid: true, message: 'Configuration appears valid' })
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        message: err instanceof Error ? err.message : 'Validation failed',
      })
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const modelData = {
        name,
        deployment_name: deploymentName,
        provider_id: providerId ? parseInt(providerId, 10) : null,
        temperature,
        streaming,
        description: description || null,
        is_default: isDefault,
        provider: providers.find(p => p.id.toString() === providerId)?.provider_type || '',
        created_by: null,
      }

      if (isEditMode && model && onUpdate) {
        await onUpdate(model.id, modelData)
        onSuccess('Model updated successfully')
      } else if (onAdd) {
        await onAdd(modelData)
        onSuccess('Model created successfully')
      }

      onOpenChange(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save model')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get selected provider for display
  const selectedProvider = providers.find(p => p.id.toString() === providerId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Model' : 'Add Model'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update model configuration settings'
              : 'Configure a new AI model for the application'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., GPT-4 Turbo"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Deployment Name */}
            <div className="grid gap-2">
              <Label htmlFor="deploymentName">Deployment Name *</Label>
              <Input
                id="deploymentName"
                value={deploymentName}
                onChange={(e) => setDeploymentName(e.target.value)}
                placeholder="e.g., gpt-4-turbo-preview"
                className={errors.deploymentName ? 'border-destructive' : ''}
              />
              {errors.deploymentName && (
                <p className="text-sm text-destructive">{errors.deploymentName}</p>
              )}
            </div>

            {/* Provider */}
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider *</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger className={errors.provider ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.is_active).map(provider => (
                    <SelectItem key={provider.id} value={provider.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{provider.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {provider.provider_type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.provider && (
                <p className="text-sm text-destructive">{errors.provider}</p>
              )}
              {selectedProvider && (
                <p className="text-xs text-muted-foreground">
                  Type: {selectedProvider.provider_type}
                  {selectedProvider.base_url && ` • URL: ${selectedProvider.base_url}`}
                </p>
              )}
            </div>

            {/* Temperature */}
            <div className="grid gap-2">
              <Label htmlFor="temperature">
                Temperature: {temperature !== null ? temperature.toFixed(1) : 'N/A'}
              </Label>
              <div className="flex items-center gap-4">
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={temperature !== null ? [temperature] : [0]}
                onValueChange={(values: number[]) => setTemperature(values[0])}
                className="flex-1"
              />
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature ?? ''}
                  onChange={(e) => setTemperature(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-20"
                  placeholder="0.0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Controls randomness: 0 = deterministic, 2 = very creative
              </p>
              {errors.temperature && (
                <p className="text-sm text-destructive">{errors.temperature}</p>
              )}
            </div>

            {/* Streaming */}
            <div className="flex items-center justify-between">
              <Label htmlFor="streaming">Streaming</Label>
              <Switch
                id="streaming"
                checked={streaming}
                onCheckedChange={setStreaming}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this model's purpose"
                rows={3}
              />
            </div>

            {/* Is Default */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">Set as Default Model</Label>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>

            {/* Is Multimodal */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isMultimodal">Set as Multimodal Model</Label>
              <Switch
                id="isMultimodal"
                checked={isMultimodal}
                onCheckedChange={setIsMultimodal}
              />
            </div>

            {/* Validation Result */}
            {validationResult && (
              <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
                {validationResult.valid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {validationResult.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            {/* Validate button (only in add mode or when deployment changed) */}
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleValidateDeployment}
                disabled={isValidating || !deploymentName || !providerId}
              >
                {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate Configuration
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Update Model' : 'Create Model'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
