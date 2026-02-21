import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/embedding-models/')({
  component: () => (
    <PlaceholderPage
      title="Embedding Models"
      description="Manage embedding models for vector generation."
      features={[
        "Configure embedding models",
        "Model deployment settings",
        "Embedding dimensions",
        "Model performance metrics",
      ]}
    />
  ),
})
