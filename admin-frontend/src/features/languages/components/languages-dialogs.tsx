'use client'

import { useState } from 'react'
import { useLanguagesContext } from './languages-provider'
import { AdminDialog, AdminDeleteDialog } from '@/components/admin'
import { languageSchema } from '../data/schema'

export function LanguagesDialogs() {
  const {
    currentRow,
    actionDialogOpen,
    setActionDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    createLanguage,
    updateLanguage,
    deleteLanguage,
  } = useLanguagesContext()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async (data: { language_code: string; language_name: string; is_active: boolean }) => {
    setIsSubmitting(true)
    const success = await createLanguage(data)
    setIsSubmitting(false)
    return success
  }

  const handleUpdate = async (data: { language_code: string; language_name: string; is_active: boolean }) => {
    if (!currentRow) return false
    setIsSubmitting(true)
    const success = await updateLanguage(currentRow.id, data)
    setIsSubmitting(false)
    return success
  }

  const handleDelete = async () => {
    if (!currentRow) return false
    setIsSubmitting(true)
    const success = await deleteLanguage(currentRow.id)
    setIsSubmitting(false)
    return success
  }

  return (
    <>
      <AdminDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        title={currentRow ? 'Edit Language' : 'Add Language'}
        schema={languageSchema}
        onSubmit={currentRow ? handleUpdate : handleCreate}
        isSubmitting={isSubmitting}
        defaultValues={currentRow ? {
          language_code: currentRow.language_code,
          language_name: currentRow.language_name,
          is_active: currentRow.is_active,
        } : undefined}
        fields={[
          { name: 'language_code', label: 'Language Code', placeholder: 'e.g., en', type: 'text' as const },
          { name: 'language_name', label: 'Language Name', placeholder: 'e.g., English', type: 'text' as const },
          { name: 'is_active', label: 'Active', type: 'switch' as const },
        ]}
      />

      <AdminDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isSubmitting={isSubmitting}
        currentRow={currentRow}
      />
    </>
  )
}
