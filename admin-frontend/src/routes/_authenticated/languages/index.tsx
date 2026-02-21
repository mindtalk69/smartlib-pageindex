import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/languages/')({
  component: () => (
    <PlaceholderPage
      title="LLM Languages"
      description="Manage supported languages for LLM responses."
      features={[
        "Configure available languages",
        "Set default language",
        "Language-specific prompts",
        "Translation settings",
      ]}
    />
  ),
})
