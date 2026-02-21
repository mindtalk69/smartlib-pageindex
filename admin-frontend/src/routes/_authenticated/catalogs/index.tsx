import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Catalogs } from '@/features/catalogs'

const catalogsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
})

export const Route = createFileRoute('/_authenticated/catalogs/')({
  validateSearch: catalogsSearchSchema,
  component: Catalogs,
})
