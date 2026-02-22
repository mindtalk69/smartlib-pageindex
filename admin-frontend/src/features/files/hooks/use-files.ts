import { useState, useCallback, useEffect } from 'react'
import { fetchCSRFToken } from '@/lib/api-client'

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
      const csrfToken = await fetchCSRFToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken
      }

      const response = await fetch(`/api/admin/files?page=${page}&per_page=${per_page}`, {
        method: 'GET',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.success) {
        setFiles(data.items || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 0)
      } else {
        setError(data.error || 'Failed to fetch files')
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
