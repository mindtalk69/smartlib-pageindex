import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/logo-settings/')({
  component: () => (
    <PlaceholderPage
      title="Logo Settings"
      description="Configure application logo and branding."
      features={[
        "Upload custom logo",
        "Logo size and positioning",
        "Favicon configuration",
        "Branding presets",
      ]}
    />
  ),
})
