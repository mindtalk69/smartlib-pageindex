/**
 * Providers Page - LLM Provider management
 *
 * Features:
 * - Provider list with CRUD operations
 * - Add/Edit provider dialog
 * - Test connection and discover models actions
 * - Delete confirmation with model count check
 * - Toast notifications for all actions
 */

import { useState, useCallback } from 'react'
import { useProviders, LLMProvider } from '@/hooks/useProviders'
import { ProviderList } from '@/components/providers/ProviderList'
import { ProviderDialog } from '@/components/providers/ProviderDialog'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export function Providers() {
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<number | null>(null)

  const {
    providers,
    isLoading,
    error,
    refreshProviders,
    addProvider,
    updateProvider,
    deleteProvider,
    testConnection,
    discoverModels,
    updatePriorities,
  } = useProviders()

  // Handle add provider
  const handleAdd = useCallback(() => {
    setSelectedProvider(null)
    setDialogOpen(true)
  }, [])

  // Handle edit provider
  const handleEdit = useCallback((provider: LLMProvider) => {
    setSelectedProvider(provider)
    setDialogOpen(true)
  }, [])

  // Handle delete confirmation
  const handleDeleteClick = useCallback((id: number) => {
    setProviderToDelete(id)
    setDeleteConfirmOpen(true)
  }, [])

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!providerToDelete) return

    try {
      const result = await deleteProvider(providerToDelete)
      if (result.success) {
        toast.success('Provider deleted successfully')
      } else {
        toast.error(result.error || 'Failed to delete provider')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete provider'
      toast.error(errorMsg)
    } finally {
      setDeleteConfirmOpen(false)
      setProviderToDelete(null)
    }
  }, [providerToDelete, deleteProvider])

  // Handle test connection
  const handleTestConnection = useCallback(async (id: number) => {
    try {
      const result = await testConnection(id)
      if (result.success) {
        toast.success(`Connection test: ${result.status || 'successful'}`)
      } else {
        toast.error(result.error || 'Connection test failed')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection test failed'
      toast.error(errorMsg)
    }
  }, [testConnection])

  // Handle discover models
  const handleDiscoverModels = useCallback(async (id: number) => {
    try {
      const result = await discoverModels(id)
      if (result.success && result.models) {
        toast.success(`Found ${result.models.length} models`)
      } else if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Models discovered')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to discover models'
      toast.error(errorMsg)
    }
  }, [discoverModels])

  // Handle priority change
  const handlePriorityChange = useCallback(async (id: number, priority: number) => {
    try {
      const result = await updatePriorities([{ id, priority }])
      if (result.success) {
        toast.success('Priority updated')
      } else {
        toast.error(result.error || 'Failed to update priority')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update priority'
      toast.error(errorMsg)
    }
  }, [updatePriorities])

  // Handle add provider from dialog
  const handleAddProvider = useCallback(async (
    provider: Omit<LLMProvider, 'id' | 'created_at' | 'updated_at'>
  ) => {
    const result = await addProvider(provider)
    if (result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  }, [addProvider])

  // Handle update provider from dialog
  const handleUpdateProvider = useCallback(async (
    id: number,
    updates: Partial<LLMProvider>
  ) => {
    const result = await updateProvider(id, updates)
    if (result.success) {
      return { success: true }
    } else {
      return { success: false, error: result.error }
    }
  }, [updateProvider])

  // Handle test connection from dialog
  const handleTestConnectionFromDialog = useCallback(async (id: number) => {
    return await testConnection(id)
  }, [testConnection])

  // Handle success messages
  const handleSuccess = useCallback((message: string) => {
    toast.success(message)
  }, [])

  // Handle error messages
  const handleError = useCallback((message: string) => {
    toast.error(message)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">LLM Providers</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage LLM providers for AI capabilities
          </p>
        </div>
        <Button onClick={handleAdd}>
          Add Provider
        </Button>
      </div>

      {/* Provider list */}
      <ProviderList
        providers={providers}
        isLoading={isLoading}
        error={error}
        onRefresh={refreshProviders}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onTestConnection={handleTestConnection}
        onDiscoverModels={handleDiscoverModels}
        onPriorityChange={handlePriorityChange}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Add/Edit dialog */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={selectedProvider}
        onSuccess={handleSuccess}
        onError={handleError}
        onAdd={handleAddProvider}
        onUpdate={handleUpdateProvider}
        onTestConnection={handleTestConnectionFromDialog}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this provider? This action cannot be undone.
              {providerToDelete && (
                <div className="mt-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  Note: If this provider has associated models, deletion will fail.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
