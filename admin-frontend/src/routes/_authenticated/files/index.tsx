import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Files } from '@/features/files'

const filesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
})

export const Route = createFileRoute('/_authenticated/files/')({
  validateSearch: filesSearchSchema,
  component: Files,
})
