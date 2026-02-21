import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/app-settings/')({
  component: () => (
    <PlaceholderPage
      title="App Settings"
      description="Configure application-wide settings."
      features={[
        "General application settings",
        "Feature toggles",
        "System configuration",
        "Environment variables",
      ]}
    />
  ),
})
