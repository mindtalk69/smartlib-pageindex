'use client'

import { useProviders } from './providers-provider'
import { ProvidersActionDialog } from './providers-action-dialog'
import { ProvidersDeleteDialog } from './providers-delete-dialog'

export function ProvidersDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useProviders()

  return (
    <>
      <ProvidersActionDialog
        key='provider-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <ProvidersActionDialog
            key={`provider-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ProvidersDeleteDialog
            key={`provider-delete-${currentRow.id}`}
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
