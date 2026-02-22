import { createFileRoute } from '@tanstack/react-router'
import { UrlDownloads } from '@/features/url-downloads'

export const Route = createFileRoute('/_authenticated/url-downloads/')({
  component: UrlDownloads,
})
