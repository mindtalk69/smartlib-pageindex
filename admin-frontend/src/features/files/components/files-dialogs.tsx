'use client'

import { useFiles } from './files-provider'
import { FilesDeleteDialog } from './files-delete-dialog'

export function FilesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useFiles()

  return (
    <>
      {currentRow && (
        <FilesDeleteDialog
          key={`file-delete-${currentRow.id}`}
          open={open === 'delete'}
          onOpenChange={() => {
            setOpen('delete')
            setTimeout(() => {
              setCurrentRow(null)
            }, 500)
          }}
          currentRow={currentRow}
        />
      )}
    </>
  )
}
