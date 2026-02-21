import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/vector-settings/')({
  component: () => (
    <PlaceholderPage
      title="Vector Settings"
      description="Configure vector store and embedding settings."
      features={[
        "Vector store configuration",
        "Embedding model settings",
        "Similarity threshold settings",
        "Vector cleanup policies",
      ]}
    />
  ),
})
