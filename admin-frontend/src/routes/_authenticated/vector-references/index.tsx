import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/vector-references/')({
  component: () => (
    <PlaceholderPage
      title="Vector References"
      description="View and manage vector store references."
      features={[
        "View vector embeddings",
        "Manage vector associations",
        "Vector metadata viewing",
        "Cleanup unused vectors",
      ]}
    />
  ),
})
