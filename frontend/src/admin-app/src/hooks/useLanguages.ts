/**
 * useLanguages Hook - Language Management API Data Fetching and CRUD Operations
 *
 * Provides functionality for managing LLM languages:
 * - Fetch languages from GET /api/v1/admin/languages
 * - CRUD operations: add, update, delete
 * - Toggle active status
 * - Loading and error state management
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/apiClient'

export interface LlmLanguage {
    id: number
    language_code: string  // e.g., 'en', 'zh', 'es'
    language_name: string  // e.g., 'English', 'Chinese', 'Spanish'
    is_active: boolean
    created_by: string | null
    created_at: string
}

interface LanguagesResponse {
    languages: LlmLanguage[]
}

interface LanguageApiResponse {
    status: string
    message: string
    language?: LlmLanguage
}

export function useLanguages() {
    const [languages, setLanguages] = useState<LlmLanguage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchLanguages = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await api.get<LanguagesResponse>('/api/v1/admin/languages')
            // Sort by language_name for consistent display
            const sortedLanguages = (data.languages || []).sort((a, b) =>
                a.language_name.localeCompare(b.language_name)
            )
            setLanguages(sortedLanguages)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch languages')
            setLanguages([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    const addLanguage = async (language: Omit<LlmLanguage, 'id' | 'created_at' | 'created_by'>): Promise<LlmLanguage | null> => {
        try {
            const result = await api.post<LanguageApiResponse, Omit<LlmLanguage, 'id' | 'created_at' | 'created_by'>>(
                '/api/v1/admin/languages/add',
                language
            )
            await fetchLanguages()
            return result.language || null
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add language'
            setError(errorMessage)
            throw new Error(errorMessage)
        }
    }

    const updateLanguage = async (id: number, updates: Partial<LlmLanguage>): Promise<LlmLanguage | null> => {
        try {
            const result = await api.post<LanguageApiResponse, Partial<LlmLanguage>>(
                `/api/v1/admin/languages/edit/${id}`,
                updates
            )
            await fetchLanguages()
            return result.language || null
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update language'
            setError(errorMessage)
            throw new Error(errorMessage)
        }
    }

    const deleteLanguage = async (id: number): Promise<boolean> => {
        try {
            await api.post<LanguageApiResponse>(`/api/v1/admin/languages/delete/${id}`)
            await fetchLanguages()
            return true
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete language'
            setError(errorMessage)
            throw new Error(errorMessage)
        }
    }

    const toggleActive = async (id: number, currentStatus: boolean): Promise<LlmLanguage | null> => {
        return updateLanguage(id, { is_active: !currentStatus })
    }

    useEffect(() => {
        fetchLanguages()
    }, [fetchLanguages])

    return {
        languages,
        isLoading,
        error,
        refreshLanguages: fetchLanguages,
        addLanguage,
        updateLanguage,
        deleteLanguage,
        toggleActive
    }
}
