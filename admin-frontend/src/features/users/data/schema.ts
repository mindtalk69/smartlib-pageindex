import { z } from 'zod'

// Schema matches the Flask API User type from api-client.ts
const userSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  is_admin: z.boolean(),
  is_disabled: z.boolean(),
  created_at: z.string(),
})
export type User = z.infer<typeof userSchema>

export const userListSchema = z.array(userSchema)

// Helper to convert API status to display status
export function getUserStatus(user: User): 'active' | 'inactive' {
  return user.is_disabled ? 'inactive' : 'active'
}

// Helper to convert API role to display role
export function getUserRole(user: User): 'superadmin' | 'admin' {
  return user.is_admin ? 'superadmin' : 'admin'
}
