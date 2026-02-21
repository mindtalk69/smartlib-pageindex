'use client'

import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'

// Common languages for description generation
export const AI_LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
]

interface AiDescriptionButtonProps {
  onGenerate: (language: string) => Promise<void>
  disabled?: boolean
  loading?: boolean
}

export function AiDescriptionButton({ onGenerate, disabled, loading }: AiDescriptionButtonProps) {
  const [language, setLanguage] = useState<string>('English')

  const handleClick = async () => {
    await onGenerate(language)
  }

  return (
    <div className='flex items-center gap-2'>
      <Select value={language} onValueChange={setLanguage}>
        <SelectTrigger className='w-[120px] h-8 text-xs'>
          <SelectValue placeholder='Language' />
        </SelectTrigger>
        <SelectContent>
          {AI_LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={handleClick}
        disabled={disabled || loading}
        className='gap-1 h-8'
      >
        {loading ? (
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
        ) : (
          <Sparkles className='h-3.5 w-3.5' />
        )}
        <span>Generate</span>
      </Button>
    </div>
  )
}
