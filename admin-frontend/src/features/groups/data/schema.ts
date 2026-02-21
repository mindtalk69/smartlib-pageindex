import { z } from 'zod'

const groupSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  name: z.string(),
  description: z.string(),
  creator_name: z.string(),
  created_at: z.string(),
})
export type Group = z.infer<typeof groupSchema>

export const groupListSchema = z.array(groupSchema)
