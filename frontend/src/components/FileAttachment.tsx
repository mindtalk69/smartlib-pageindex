import { useRef, useState, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Paperclip, X } from 'lucide-react'

interface FileAttachmentProps {
    onFileSelect: (file: File | null, base64?: string) => void
    onImageSelect: (base64: string, mimeType: string) => void
    disabled?: boolean
}

/**
 * FileAttachment Component
 * 
 * Handles file uploads for:
 * - Images (for vision analysis)
 * - CSV/Excel files (for DataFrame analysis)
 * Uses shadcn/ui Button and Lucide icons.
 */
export function FileAttachment({
    onFileSelect,
    onImageSelect,
    disabled
}: FileAttachmentProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) {
            setSelectedFile(null)
            onFileSelect(null)
            return
        }

        setSelectedFile(file)

        // Handle image files
        if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                onImageSelect(base64, file.type)
            }
            reader.readAsDataURL(file)
            return
        }

        // Handle CSV/Excel files
        if (file.name.endsWith('.csv')) {
            const text = await file.text()
            onFileSelect(file, text)
        } else if (file.name.match(/\.xlsx?$/)) {
            const reader = new FileReader()
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                onFileSelect(file, base64)
            }
            reader.readAsDataURL(file)
        } else {
            onFileSelect(file)
        }
    }

    const handleClear = () => {
        setSelectedFile(null)
        onFileSelect(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex items-center gap-1">
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleChange}
                accept="image/*,.csv,.xlsx,.xls"
                className="hidden"
                disabled={disabled}
            />

            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClick}
                disabled={disabled}
                title="Attach file or image"
            >
                <Paperclip className="h-4 w-4" />
            </Button>

            {selectedFile && (
                <Badge variant="secondary" className="gap-1 pr-1">
                    <span className="max-w-24 truncate text-xs">{selectedFile.name}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={handleClear}
                        title="Remove attachment"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            )}
        </div>
    )
}
