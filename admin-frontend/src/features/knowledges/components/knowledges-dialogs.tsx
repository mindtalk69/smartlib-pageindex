'use client'

import { useKnowledges } from './knowledges-provider'
import { KnowledgesActionDialog } from './knowledges-action-dialog'
import { KnowledgesDeleteDialog } from './knowledges-delete-dialog'

export function KnowledgesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useKnowledges()

  return (
    <>
      <KnowledgesActionDialog
        key='knowledge-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <KnowledgesActionDialog
            key={`knowledge-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <KnowledgesDeleteDialog
            key={`knowledge-delete-${currentRow.id}`}
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
