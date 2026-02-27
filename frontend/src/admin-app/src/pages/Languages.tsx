/**
 * Languages Page - LLM Language Management
 *
 * Features:
 * - Language list with CRUD operations
 * - Add/Edit language dialog
 * - Toggle active status
 * - Delete confirmation
 * - Toast notifications for all actions
 */

import { useState, useCallback } from 'react'
import { useLanguages, LlmLanguage } from '@/hooks/useLanguages'
import { LanguageList } from '@/components/languages/LanguageList'
import { LanguageDialog } from '@/components/languages/LanguageDialog'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function Languages() {
    const [selectedLanguage, setSelectedLanguage] = useState<LlmLanguage | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)

    const {
        languages,
        isLoading,
        error,
        refreshLanguages,
        addLanguage,
        updateLanguage,
        deleteLanguage,
        toggleActive,
    } = useLanguages()

    // Handle add language
    const handleAdd = useCallback(() => {
        setSelectedLanguage(null)
        setDialogOpen(true)
    }, [])

    // Handle edit language
    const handleEdit = useCallback((language: LlmLanguage) => {
        setSelectedLanguage(language)
        setDialogOpen(true)
    }, [])

    // Handle delete
    const handleDelete = useCallback(async (id: number) => {
        await deleteLanguage(id)
    }, [deleteLanguage])

    // Handle toggle active
    const handleToggleActive = useCallback(async (id: number, currentStatus: boolean) => {
        await toggleActive(id, currentStatus)
    }, [toggleActive])

    // Handle dialog submit
    const handleDialogSubmit = useCallback(async (data: {
        language_code: string
        language_name: string
        is_active: boolean
    }) => {
        if (selectedLanguage) {
            // Edit mode
            await updateLanguage(selectedLanguage.id, data)
        } else {
            // Add mode
            await addLanguage(data)
        }
    }, [selectedLanguage, addLanguage, updateLanguage])

    // Handle success
    const handleSuccess = useCallback((message: string) => {
        toast.success(message)
    }, [])

    // Handle error
    const handleError = useCallback((message: string) => {
        toast.error(message)
    }, [])

    // Handle dialog open change
    const handleDialogOpenChange = useCallback((open: boolean) => {
        setDialogOpen(open)
        if (!open) {
            setSelectedLanguage(null)
        }
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading languages...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-destructive">Error: {error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">LLM Languages</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage supported languages for LLM operations
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Language
                </Button>
            </div>

            {/* Language List */}
            <LanguageList
                languages={languages}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onSuccess={handleSuccess}
                onError={handleError}
            />

            {/* Add/Edit Dialog */}
            <LanguageDialog
                open={dialogOpen}
                onOpenChange={handleDialogOpenChange}
                language={selectedLanguage}
                onSuccess={handleSuccess}
                onError={handleError}
                onSubmit={handleDialogSubmit}
            />
        </div>
    )
}
