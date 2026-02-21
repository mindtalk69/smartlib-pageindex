import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/url-downloads/')({
  component: () => (
    <PlaceholderPage
      title="URL Downloads"
      description="Download content from URLs for processing."
      features={[
        "Download files from URLs",
        "Batch URL processing",
        "Download history tracking",
        "Support for multiple file types",
      ]}
    />
  ),
})
