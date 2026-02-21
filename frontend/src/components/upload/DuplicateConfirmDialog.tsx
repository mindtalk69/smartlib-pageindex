import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { motion } from 'framer-motion'
import { AlertTriangle, FileText, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface DuplicateFile {
    filename: string
    file_id: number
    upload_time?: string
}

interface DuplicateConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    duplicates: DuplicateFile[]
    onConfirm: () => void
}

export function DuplicateConfirmDialog({
    open,
    onOpenChange,
    duplicates,
    onConfirm,
}: DuplicateConfirmDialogProps) {
    const formatDate = (dateString?: string): string => {
        if (!dateString) return 'Unknown date'
        try {
            const date = new Date(dateString)
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return 'Invalid date'
        }
    }

    const handleConfirm = () => {
        onConfirm()
        onOpenChange(false)
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-full bg-yellow-500/10">
                            <AlertTriangle className="h-6 w-6 text-yellow-500" />
                        </div>
                        <AlertDialogTitle className="text-xl">
                            Files Already Exist
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base">
                        The following {duplicates.length} file{duplicates.length > 1 ? 's' : ''} already exist in this library.
                        Uploading will <strong className="text-foreground">replace</strong> the existing files with new versions.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="my-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                        {duplicates.map((file, index) => (
                            <motion.div
                                key={file.file_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-yellow-500/5 border-yellow-500/20"
                            >
                                <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {file.filename}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                            Previously uploaded: {formatDate(file.upload_time)}
                                        </span>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                    ID: {file.file_id}
                                </Badge>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">
                            Previous content will be removed from the vector store and replaced with the new versions.
                            This action cannot be undone.
                        </span>
                    </p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                        Replace Files
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
