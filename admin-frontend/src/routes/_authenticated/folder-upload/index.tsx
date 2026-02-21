import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/folder-upload/')({
  component: () => (
    <PlaceholderPage
      title="Folder Upload"
      description="Upload entire folders for batch processing."
      features={[
        "Upload folders with multiple files",
        "Preserve folder structure",
        "Batch processing support",
        "Progress tracking",
      ]}
    />
  ),
})
