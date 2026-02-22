'use client'

import { createContext, useContext } from 'react'
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

export function FilesProvider({ children }: { children: React.ReactNode }) {
  const { files, isLoading, error, total, totalPages, refresh } = useFiles()

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
