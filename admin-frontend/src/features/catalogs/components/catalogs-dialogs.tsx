'use client'

import { useCatalogs } from './catalogs-provider'
import { CatalogsActionDialog } from './catalogs-action-dialog'
import { CatalogsDeleteDialog } from './catalogs-delete-dialog'

export function CatalogsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useCatalogs()

  return (
    <>
      <CatalogsActionDialog
        key='catalog-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <CatalogsActionDialog
            key={`catalog-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <CatalogsDeleteDialog
            key={`catalog-delete-${currentRow.id}`}
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
