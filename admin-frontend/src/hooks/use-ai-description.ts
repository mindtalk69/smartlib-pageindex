import { useState, useCallback } from 'react'
import { aiDescriptionApi, type GenerateDescriptionRequest } from '@/lib/api-client'
import { toast } from 'sonner'

interface UseAiDescriptionOptions {
  itemType: GenerateDescriptionRequest['item_type']
  onSuccess?: (description: string) => void
  onError?: (error: string) => void
}

export function useAiDescription({ itemType, onSuccess, onError }: UseAiDescriptionOptions) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [language, setLanguage] = useState<string>('English')

  const generateDescription = useCallback(async (
    contextText: string,
    selectedLanguage?: string
  ): Promise<string | null> => {
    if (!contextText.trim()) {
      toast.warning('Please enter a name first to generate a description.')
      return null
    }

    setIsGenerating(true)
    try {
      const result = await aiDescriptionApi.generate({
        context_text: contextText,
        item_type: itemType,
        language: selectedLanguage || language,
      })

      if (result.success && result.description) {
        toast.success('Description generated successfully')
        if (onSuccess) onSuccess(result.description)
        return result.description
      } else {
        const errorMessage = result.error || 'Failed to generate description'
        toast.error(errorMessage)
        if (onError) onError(errorMessage)
        return null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate description'
      toast.error(errorMessage)
      if (onError) onError(errorMessage)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [itemType, language, onSuccess, onError])

  return {
    isGenerating,
    language,
    setLanguage,
    generateDescription,
  }
}
