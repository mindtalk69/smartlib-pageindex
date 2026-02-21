import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Knowledges } from '@/features/knowledges'

const knowledgesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
})

export const Route = createFileRoute('/_authenticated/knowledges/')({
  validateSearch: knowledgesSearchSchema,
  component: Knowledges,
})
