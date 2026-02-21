import { z } from 'zod'

// Schema for LLM model
const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  deployment_name: z.string(),
  provider_id: z.string(),
  provider: z.string(),
  provider_name: z.string().optional(),
  provider_type: z.string().optional(),
  temperature: z.number().nullable().optional(),
  streaming: z.boolean(),
  description: z.string().nullable().optional(),
  is_default: z.boolean(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
})

export type Model = z.infer<typeof modelSchema>

export const modelListSchema = z.array(modelSchema)
