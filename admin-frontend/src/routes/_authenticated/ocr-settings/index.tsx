import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/ocr-settings/')({
  component: () => (
    <PlaceholderPage
      title="OCR Settings"
      description="Configure OCR (Optical Character Recognition) settings."
      features={[
        "OCR provider configuration",
        "Language settings for OCR",
        "Processing quality options",
        "OCR history and logs",
      ]}
    />
  ),
})
