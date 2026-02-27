import { useState, useCallback, useEffect } from 'react'
import { filesApi } from '@/lib/api-client'

export interface File {
  id: number
  file_id: number
  filename: string
  file_size: number
  upload_time: string
  username: string
  library_name: string | null
  knowledge_name: string | null
  is_ocr: boolean
}

interface UseFilesOptions {
  page?: number
  per_page?: number
}

export function useFiles(options: UseFilesOptions = {}) {
  const { page = 1, per_page = 10 } = options
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response: any = await filesApi.getAll({ page, per_page })

      if (response.success || response.items) {
        setFiles(response.items || response.data?.items || [])
        setTotal(response.total || response.data?.total || 0)
        setTotalPages(response.total_pages || response.data?.total_pages || 0)
      } else {
        setError(response.error || 'Failed to fetch files')
        setFiles([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [page, per_page])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  return {
    files,
    isLoading,
    error,
    total,
    totalPages,
    refresh: loadFiles,
  }
}
