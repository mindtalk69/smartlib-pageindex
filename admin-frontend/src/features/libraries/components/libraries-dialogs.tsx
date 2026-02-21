'use client'

import { useLibraries } from './libraries-provider'
import { LibrariesActionDialog } from './libraries-action-dialog'
import { LibrariesDeleteDialog } from './libraries-delete-dialog'

export function LibrariesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useLibraries()

  return (
    <>
      <LibrariesActionDialog
        key='library-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <LibrariesActionDialog
            key={`library-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <LibrariesDeleteDialog
            key={`library-delete-${currentRow.id}`}
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
