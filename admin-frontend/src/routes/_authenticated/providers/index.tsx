import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Providers } from '@/features/providers'

const providersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(z.union([z.literal('active'), z.literal('inactive')]))
    .optional()
    .catch([]),
  type: z.array(z.string()).optional().catch([]),
  search: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/providers/')({
  validateSearch: providersSearchSchema,
  component: Providers,
})
