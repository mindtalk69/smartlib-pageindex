import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/message-history/')({
  component: () => (
    <PlaceholderPage
      title="Message History"
      description="View and manage conversation message history."
      features={[
        "View all conversation history",
        "Search messages",
        "Export conversation logs",
        "Message analytics",
      ]}
    />
  ),
})
