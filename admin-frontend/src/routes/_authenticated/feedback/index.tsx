import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/feedback/')({
  component: () => (
    <PlaceholderPage
      title="Feedback"
      description="View and manage user feedback."
      features={[
        "View user feedback",
        "Feedback analytics",
        "Respond to feedback",
        "Feedback categorization",
      ]}
    />
  ),
})
