import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/reset-data/')({
  component: () => (
    <PlaceholderPage
      title="Reset Data"
      description="Reset application data and configurations."
      features={[
        "Reset vector stores",
        "Clear conversation history",
        "Reset model configurations",
        "Data cleanup utilities",
      ]}
    />
  ),
})
