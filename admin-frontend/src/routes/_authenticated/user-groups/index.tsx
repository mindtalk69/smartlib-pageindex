import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_authenticated/user-groups/')({
  component: () => (
    <PlaceholderPage
      title="User Groups"
      description="Manage user group memberships and associations."
      features={[
        "View user group memberships",
        "Add users to groups",
        "Remove users from groups",
        "Manage group permissions",
      ]}
    />
  ),
})
