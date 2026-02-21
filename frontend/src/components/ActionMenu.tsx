import { useRef } from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquarePlus, FolderUp, Camera, X, Check, Loader2, Upload } from 'lucide-react'

interface ActionMenuProps {
    onUploadFile: (file: File) => void
    onAttachFile?: (file: File) => void  // NEW: For inline chat attachments (images, CSV, Excel)
    onCaptureScreen: () => void
    onNewConversation: () => void
    disabled?: boolean
}

/**
 * ActionMenu Component (+ Button)
 * 
 * Dropdown menu with:
 * - New Conversation
 * - Attach File (for inline chat attachment - images, CSV, Excel for analysis)
 * - Capture Screen (screenshot for vision analysis)
 * - Upload Documents (link to /upload page for ingestion)
 * Uses shadcn/ui DropdownMenu and Lucide icons.
 */
export function ActionMenu({
    onUploadFile,
    onAttachFile,
    onCaptureScreen,
    onNewConversation,
    disabled
}: ActionMenuProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Use onAttachFile for inline attachments, fallback to onUploadFile
            if (onAttachFile) {
                onAttachFile(file)
            } else {
                onUploadFile(file)
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <DropdownMenu>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/*,.csv,.tsv,.xlsx"
                className="hidden"
                disabled={disabled}
            />

            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem
                    onClick={onNewConversation}
                    className="gap-2"
                    title="Clear chat and start fresh. Shows suggested questions if enabled in Settings."
                >
                    <MessageSquarePlus className="h-4 w-4" /> New Conversation
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleFileClick}
                    className="gap-2"
                    title="Attach an image or data file (CSV, TSV, Excel .xlsx) to analyze in chat"
                >
                    <FolderUp className="h-4 w-4" /> Attach File
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={onCaptureScreen}
                    className="gap-2"
                    title="Share a window/screen to capture. Tip: Use ⌘+Shift+4 then paste for faster screenshots!"
                >
                    <Camera className="h-4 w-4" /> Capture Screen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <a href="/app/upload" className="gap-2" title="Go to upload page to add documents to the knowledge base">
                        <Upload className="h-4 w-4" /> Upload Documents
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/**
 * UploadProgress Component
 * 
 * Shows upload progress for document ingestion.
 */
interface UploadProgressProps {
    fileName: string
    progress: number
    status: 'uploading' | 'processing' | 'done' | 'error'
    error?: string
    onCancel?: () => void
}

export function UploadProgress({
    fileName,
    progress,
    status,
    error,
    onCancel
}: UploadProgressProps) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${status === 'error' ? 'border-destructive bg-destructive/10' :
            status === 'done' ? 'border-green-500 bg-green-500/10' :
                'border-border bg-muted'
            }`}>
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">{fileName}</span>
                {status === 'uploading' && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                    </div>
                )}
                {status === 'processing' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Processing...
                    </span>
                )}
                {status === 'done' && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Done
                    </span>
                )}
                {status === 'error' && (
                    <span className="text-xs text-destructive">{error}</span>
                )}
            </div>

            {status === 'uploading' && onCancel && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
                    <X className="h-3 w-3" />
                </Button>
            )}
        </div>
    )
}
