'use client'

import { useResetRequests } from './reset-requests-provider'
import { ApproveDialog } from './approve-dialog'
import { DenyDialog } from './deny-dialog'

export function ResetRequestsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useResetRequests()

  const handleClose = () => {
    setOpen(null)
    setCurrentRow(null)
  }

  return (
    <>
      <ApproveDialog
        open={open === 'approve'}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose()
        }}
        resetRequest={currentRow}
      />
      <DenyDialog
        open={open === 'deny'}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose()
        }}
        resetRequest={currentRow}
      />
    </>
  )
}
