import { z } from 'zod'

export const languageSchema = z.object({
    language_code: z.string().min(1, { message: 'Language code is required' }),
    language_name: z.string().min(1, { message: 'Language name is required' }),
    is_active: z.boolean().default(true),
})

export type Language = z.infer<typeof languageSchema> & { id: number }
