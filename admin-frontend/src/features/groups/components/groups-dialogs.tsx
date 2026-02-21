'use client'

import { useGroups } from './groups-provider'
import { GroupsActionDialog } from './groups-action-dialog'
import { GroupsDeleteDialog } from './groups-delete-dialog'

export function GroupsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useGroups()

  return (
    <>
      <GroupsActionDialog
        key='group-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <GroupsActionDialog
            key={`group-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <GroupsDeleteDialog
            key={`group-delete-${currentRow.id}`}
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
