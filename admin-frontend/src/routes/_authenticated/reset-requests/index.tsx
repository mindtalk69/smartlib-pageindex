import { createFileRoute } from '@tanstack/react-router'
import { ResetRequestsPage } from '@/features/reset-requests'

export const Route = createFileRoute('/_authenticated/reset-requests/')({
  component: ResetRequestsPage,
})
