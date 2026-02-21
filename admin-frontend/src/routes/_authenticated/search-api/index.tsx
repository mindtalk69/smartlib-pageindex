import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/search-api/')({
  component: () => (
    <PlaceholderPage
      title="Search API Settings"
      description="Configure external search API settings."
      features={[
        "Search provider configuration",
        "API key management",
        "Search result limits",
        "Custom search parameters",
      ]}
    />
  ),
})
