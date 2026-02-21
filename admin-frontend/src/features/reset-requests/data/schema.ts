import { z } from 'zod'

// Schema for password reset request
const resetRequestSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'denied']),
  created_at: z.string(),
  processed_at: z.string().nullable(),
  processed_by: z.string().nullable(),
  request_reason: z.string().nullable(),
  admin_notes: z.string().nullable(),
})

export type ResetRequest = z.infer<typeof resetRequestSchema>

export const resetRequestListSchema = z.array(resetRequestSchema)

// Helper to get status badge variant
export function getStatusVariant(status: string): string {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'completed':
      return 'success'
    case 'denied':
      return 'destructive'
    default:
      return 'secondary'
  }
}
