import { createFileRoute } from '@tanstack/react-router'
import { FolderUpload } from '@/features/folder-upload'

export const Route = createFileRoute('/_authenticated/folder-upload/')({
  component: FolderUpload,
})
