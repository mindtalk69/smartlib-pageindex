import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/visual-grounding-settings/')({
  component: () => (
    <PlaceholderPage
      title="Visual Grounding Settings"
      description="Configure visual grounding settings."
      features={[
        "Visual grounding model configuration",
        "Bounding box settings",
        "Image processing options",
        "Response formatting",
      ]}
    />
  ),
})
