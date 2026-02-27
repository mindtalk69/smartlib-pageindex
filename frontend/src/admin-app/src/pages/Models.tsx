/**
 * Models Page - Model Configuration Management
 *
 * Features:
 * - Admin layout integration
 * - Model list with CRUD operations
 * - Add/Edit dialog
 * - Delete confirmation
 * - Set default/multimodal actions
 * - Toast notifications
 */

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useModels, ModelConfig } from '@/hooks/useModels'
import { useProviders } from '@/hooks/useProviders'
import { ModelList } from '@/components/models/ModelList'
import { ModelDialog } from '@/components/models/ModelDialog'

export default function Models() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null)
  const [deleteModelId, setDeleteModelId] = useState<number | null>(null)

  const {
    models,
    isLoading,
    error,
    refreshModels,
    addModel,
    updateModel,
    deleteModel,
    setDefault,
    setMultimodal,
  } = useModels()

  const { providers } = useProviders()

  /**
   * Handle add model
   */
  const handleAdd = () => {
    setSelectedModel(null)
    setIsDialogOpen(true)
  }

  /**
   * Handle edit model
   */
  const handleEdit = (model: ModelConfig) => {
    setSelectedModel(model)
    setIsDialogOpen(true)
  }

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = async () => {
    if (!deleteModelId) return

    try {
      await deleteModel(deleteModelId)
      toast.success('Model deleted successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete model')
    } finally {
      setDeleteModelId(null)
    }
  }

  /**
   * Handle set as default
   */
  const handleSetDefault = async (id: number) => {
    try {
      await setDefault(id)
      toast.success('Default model updated')
      refreshModels()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default model')
    }
  }

  /**
   * Handle set as multimodal
   */
  const handleSetMultimodal = async (id: number) => {
    try {
      await setMultimodal(id)
      toast.success('Multimodal model updated')
      refreshModels()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set multimodal model')
    }
  }

  /**
   * Handle dialog close
   */
  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setSelectedModel(null)
    }
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Model Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Manage AI models and their settings
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        </div>

        {/* Model List */}
        <ModelList
          models={models}
          providers={providers}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteModelId(id)}
          onSetDefault={handleSetDefault}
          onSetMultimodal={handleSetMultimodal}
          onSuccess={(message) => toast.success(message)}
          onError={(message) => toast.error(message)}
          isLoading={isLoading}
          error={error}
          onRefresh={refreshModels}
        />

        {/* Add/Edit Dialog */}
        <ModelDialog
          open={isDialogOpen}
          onOpenChange={handleDialogOpenChange}
          providers={providers}
          model={selectedModel}
          onSuccess={(message) => {
            toast.success(message)
            refreshModels()
          }}
          onError={(message) => toast.error(message)}
          onAdd={addModel}
          onUpdate={updateModel}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Model</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this model? This action cannot be undone.
                {selectedModel && (
                  <span className="font-medium ml-1">
                    &quot;{selectedModel.name}&quot;
                  </span>
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
    </AdminLayout>
  )
}
