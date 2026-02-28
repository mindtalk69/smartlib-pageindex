import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Groups } from '@/features/groups'

const groupsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(z.string())
    .optional()
    .catch([]),
  name: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/groups/')({
  validateSearch: groupsSearchSchema,
  component: Groups,
})
