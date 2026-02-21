import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/prompts/')({
  component: () => (
    <PlaceholderPage
      title="Prompts"
      description="Manage AI prompts and templates."
      features={[
        "Create and edit prompts",
        "Prompt templates library",
        "Version control for prompts",
        "Prompt testing and validation",
      ]}
    />
  ),
})
