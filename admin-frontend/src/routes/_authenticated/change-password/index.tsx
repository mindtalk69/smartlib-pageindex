import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/change-password/')({
  component: () => (
    <PlaceholderPage
      title="Change Password"
      description="Change user passwords securely."
      features={[
        "Reset user passwords",
        "Set temporary passwords",
        "Enforce password policies",
        "View password change history",
      ]}
    />
  ),
})
