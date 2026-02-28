import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Languages } from '@/features/languages'

const languagesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
})

export const Route = createFileRoute('/_authenticated/languages/')({
  validateSearch: languagesSearchSchema,
  component: Languages,
})
