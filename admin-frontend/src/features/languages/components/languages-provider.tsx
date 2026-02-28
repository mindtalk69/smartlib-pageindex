'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useLanguages } from '../hooks/use-languages'
import { fetchApi, languagesApi } from '@/lib/api-client'
import { type Language } from '@/lib/api-client'

interface LanguagesContextType {
  languages: Language[]
  isLoading: boolean
  error: string | null
  total: number
  totalPages: number
  refresh: () => Promise<void>
  createLanguage: (data: { language_code: string; language_name: string; is_active?: boolean }) => Promise<boolean>
  updateLanguage: (id: number, data: { language_code?: string; language_name?: string; is_active?: boolean }) => Promise<boolean>
  deleteLanguage: (id: number) => Promise<boolean>
  // Dialog state
  currentRow: Language | null
  setCurrentRow: (row: Language | null) => void
  actionDialogOpen: boolean
  setActionDialogOpen: (open: boolean) => void
  deleteDialogOpen: boolean
  setDeleteDialogOpen: (open: boolean) => void
}

const LanguagesContext = createContext<LanguagesContextType | undefined>(undefined)

interface LanguagesProviderProps {
  children: React.ReactNode
  search: Record<string, unknown>
  navigate: (opts: { search: Record<string, unknown>; replace?: boolean }) => void
}

export function LanguagesProvider({ children, search, navigate }: LanguagesProviderProps) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const { languages, isLoading, error, total, totalPages, refresh } = useLanguages({ page, per_page: perPage })

  // Dialog state
  const [currentRow, setCurrentRow] = useState<Language | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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

  // CRUD operations
  const createLanguage = async (data: { language_code: string; language_name: string; is_active?: boolean }) => {
    try {
      const response = await fetchApi('/admin/languages/add', { method: 'POST', body: JSON.stringify(data) })
      if (response.success) {
        await refresh()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to create language:', err)
      return false
    }
  }

  const updateLanguage = async (id: number, data: { language_code?: string; language_name?: string; is_active?: boolean }) => {
    try {
      const response = await fetchApi(`/admin/languages/edit/${id}`, { method: 'POST', body: JSON.stringify(data) })
      if (response.success) {
        await refresh()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update language:', err)
      return false
    }
  }

  const deleteLanguage = async (id: number) => {
    try {
      const response = await fetchApi(`/admin/languages/delete/${id}`, { method: 'POST' })
      if (response.success) {
        await refresh()
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to delete language:', err)
      return false
    }
  }

  return (
    <LanguagesContext.Provider
      value={{
        languages,
        isLoading,
        error,
        total,
        totalPages,
        refresh,
        createLanguage,
        updateLanguage,
        deleteLanguage,
        currentRow,
        setCurrentRow,
        actionDialogOpen,
        setActionDialogOpen,
        deleteDialogOpen,
        setDeleteDialogOpen,
      }}
    >
      {children}
    </LanguagesContext.Provider>
  )
}

export const useLanguagesContext = () => {
  const context = useContext(LanguagesContext)
  if (!context) {
    throw new Error('useLanguagesContext must be used within LanguagesProvider')
  }
  return context
}
