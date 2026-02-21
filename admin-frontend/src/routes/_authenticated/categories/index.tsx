import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Categories } from '@/features/categories'

const categoriesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
})

export const Route = createFileRoute('/_authenticated/categories/')({
  validateSearch: categoriesSearchSchema,
  component: Categories,
})
