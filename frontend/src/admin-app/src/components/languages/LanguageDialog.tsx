/**
 * LanguageDialog Component - Dialog for Add/Edit Language
 *
 * Features:
 * - Add mode: Empty form for creating new language
 * - Edit mode: Pre-filled form with existing language data
 * - Form fields: Language Code, Language Name, Is Active
 * - Form validation: Required fields, code length (2-5 chars)
 * - Language code suggestions (common ISO codes)
 * - Loading state during submission
 * - Success/error callbacks
 */

import { useState, useEffect } from 'react'
import { LlmLanguage } from '@/hooks/useLanguages'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// Common language codes for quick selection
const COMMON_LANGUAGE_CODES = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
]

export interface LanguageDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    language?: LlmLanguage | null  // If provided, edit mode
    onSuccess: (message: string) => void
    onError: (message: string) => void
    onSubmit: (data: { language_code: string; language_name: string; is_active: boolean }) => Promise<void>
}

export function LanguageDialog({
    open,
    onOpenChange,
    language,
    onSuccess,
    onError,
    onSubmit,
}: LanguageDialogProps) {
    const [languageCode, setLanguageCode] = useState('')
    const [languageName, setLanguageName] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<{ code?: string; name?: string }>({})

    const isEditMode = !!language

    // Reset form when dialog opens/closes or language changes
    useEffect(() => {
        if (open) {
            if (language) {
                // Edit mode - pre-fill form
                setLanguageCode(language.language_code)
                setLanguageName(language.language_name)
                setIsActive(language.is_active)
            } else {
                // Add mode - clear form
                setLanguageCode('')
                setLanguageName('')
                setIsActive(true)
            }
            setErrors({})
        }
    }, [open, language])

    const validateForm = (): boolean => {
        const newErrors: { code?: string; name?: string } = {}

        // Validate language code
        if (!languageCode.trim()) {
            newErrors.code = 'Language code is required'
        } else if (languageCode.length < 2 || languageCode.length > 5) {
            newErrors.code = 'Code must be 2-5 characters'
        } else if (!/^[a-z]+$/.test(languageCode)) {
            newErrors.code = 'Code must be lowercase letters only'
        }

        // Validate language name
        if (!languageName.trim()) {
            newErrors.name = 'Language name is required'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleQuickSelect = (code: string, name: string) => {
        setLanguageCode(code)
        setLanguageName(name)
        setErrors({})
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)
        try {
            await onSubmit({
                language_code: languageCode.trim().toLowerCase(),
                language_name: languageName.trim(),
                is_active: isActive,
            })
            onSuccess(isEditMode ? 'Language updated successfully' : 'Language added successfully')
            onOpenChange(false)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save language'
            onError(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditMode ? 'Edit Language' : 'Add Language'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? 'Update language details below.'
                                : 'Add a new language for LLM operations.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Language Code */}
                        <div className="space-y-2">
                            <Label htmlFor="language-code">Language Code *</Label>
                            <Input
                                id="language-code"
                                value={languageCode}
                                onChange={(e) => setLanguageCode(e.target.value.toLowerCase())}
                                placeholder="e.g., en, zh, es"
                                disabled={isSubmitting}
                                className={errors.code ? 'border-destructive' : ''}
                            />
                            {errors.code && (
                                <p className="text-sm text-destructive">{errors.code}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                2-5 lowercase letters (ISO 639-1 or 639-2)
                            </p>
                        </div>

                        {/* Language Name */}
                        <div className="space-y-2">
                            <Label htmlFor="language-name">Language Name *</Label>
                            <Input
                                id="language-name"
                                value={languageName}
                                onChange={(e) => setLanguageName(e.target.value)}
                                placeholder="e.g., English, Chinese, Spanish"
                                disabled={isSubmitting}
                                className={errors.name ? 'border-destructive' : ''}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name}</p>
                            )}
                        </div>

                        {/* Is Active */}
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="is-active"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                                disabled={isSubmitting}
                            />
                            <Label htmlFor="is-active">Active</Label>
                        </div>

                        {/* Quick Select Suggestions */}
                        {!isEditMode && (
                            <div className="space-y-2">
                                <Label>Quick Select</Label>
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_LANGUAGE_CODES.map((lang) => (
                                        <Button
                                            key={lang.code}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleQuickSelect(lang.code, lang.name)}
                                            disabled={isSubmitting}
                                            className="text-xs"
                                        >
                                            {lang.code} - {lang.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Edit mode: show created info */}
                        {isEditMode && language && (
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>Created: {new Date(language.created_at).toLocaleDateString()}</p>
                                {language.created_by && <p>By: {language.created_by}</p>}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Add Language'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default LanguageDialog
