import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/visual-grounding-activity/')({
  component: () => (
    <PlaceholderPage
      title="Visual Grounding Activity"
      description="View visual grounding activity and logs."
      features={[
        "View grounding activity logs",
        "Analyze bounding box data",
        "Image reference tracking",
        "Activity statistics",
      ]}
    />
  ),
})
