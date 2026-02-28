import { useState, useCallback, useEffect } from 'react'
import { fetchApi, type Language } from '@/lib/api-client'

interface UseLanguagesOptions {
  page?: number
  per_page?: number
}

export function useLanguages(options: UseLanguagesOptions = {}) {
  const { page = 1, per_page = 10 } = options
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const loadLanguages = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (page) params.append('skip', String((page - 1) * per_page))
      if (per_page) params.append('limit', String(per_page))

      const response: any = await fetchApi(`/admin/languages?${params.toString()}`)

      if (response.success && response.data) {
        setLanguages(response.data.items || [])
        setTotal(response.data.total || 0)
        setTotalPages(Math.ceil((response.data.total || 0) / per_page))
      } else {
        setError(response.error || 'Failed to fetch languages')
        setLanguages([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setLanguages([])
    } finally {
      setIsLoading(false)
    }
  }, [page, per_page])

  useEffect(() => {
    loadLanguages()
  }, [loadLanguages])

  return {
    languages,
    isLoading,
    error,
    total,
    totalPages,
    refresh: loadLanguages,
  }
}
