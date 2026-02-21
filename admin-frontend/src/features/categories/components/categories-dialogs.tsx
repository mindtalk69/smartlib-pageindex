'use client'

import { useCategories } from './categories-provider'
import { CategoriesActionDialog } from './categories-action-dialog'
import { CategoriesDeleteDialog } from './categories-delete-dialog'

export function CategoriesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useCategories()

  return (
    <>
      <CategoriesActionDialog
        key='category-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <CategoriesActionDialog
            key={`category-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <CategoriesDeleteDialog
            key={`category-delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
