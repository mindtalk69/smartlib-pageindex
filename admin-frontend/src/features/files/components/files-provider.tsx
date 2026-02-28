'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useFiles } from '../hooks/use-files'

interface FilesContextType {
  files: import('./hooks/use-files').File[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  refresh: () => Promise<void>
}

const FilesContext = createContext<FilesContextType | undefined>(undefined)

interface FilesProviderProps {
  children: React.ReactNode
  search: Record<string, unknown>
  navigate: (opts: { search: Record<string, unknown>; replace?: boolean }) => void
}

export function FilesProvider({ children, search, navigate }: FilesProviderProps) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { files, isLoading, error, total, totalPages, refresh } = useFiles({ page, per_page: perPage })

  // Sync pagination with URL params
  useEffect(() => {
    const pageFromUrl = typeof search.page === 'number' ? search.page : 1
    const pageSizeFromUrl = typeof search.pageSize === 'number' ? search.pageSize : 10
    setPage(pageFromUrl)
    setPerPage(pageSizeFromUrl)
  }, [search.page, search.pageSize])

  // Update URL when pagination changes
  useEffect(() => {
    navigate({
      search: {
        ...search,
        page: page > 1 ? page : undefined,
        pageSize: perPage !== 10 ? perPage : undefined,
      },
    })
  }, [page, perPage]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FilesContext.Provider
      value={{
        files,
        isLoading,
        error,
        total,
        totalPages,
        refresh,
      }}
    >
      {children}
    </FilesContext.Provider>
  )
}

export const useFilesContext = () => {
  const context = useContext(FilesContext)
  if (!context) {
    throw new Error('useFilesContext must be used within FilesProvider')
  }
  return context
}
