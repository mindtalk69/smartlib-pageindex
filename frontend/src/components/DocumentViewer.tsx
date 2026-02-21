import { useEffect, useState, useCallback } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, FileText, Copy, Check, ChevronDown, ChevronUp } from "lucide-react"

interface DocumentChunk {
    content: string
    page: number | string | null
    metadata: Record<string, unknown>
}

interface DocumentData {
    name: string
    document_id: string
    library_id: number
    page_filter: number | null
    chunks: DocumentChunk[]
    total_chunks: number
}

interface DocumentViewerProps {
    isOpen: boolean
    onClose: () => void
    libraryId: number | null
    documentId: string | null
    page?: number | null
    sourceName?: string
}

/**
 * DocumentViewer Modal Component
 * 
 * Displays document chunk content in a modal dialog.
 * Shows only the specific page if page prop is provided.
 */
export function DocumentViewer({
    isOpen,
    onClose,
    libraryId,
    documentId,
    page,
    sourceName
}: DocumentViewerProps) {
    const [data, setData] = useState<DocumentData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const [expandedMetadata, setExpandedMetadata] = useState<Set<number>>(new Set())

    // Fetch document content
    useEffect(() => {
        if (!isOpen || !libraryId || !documentId) {
            setData(null)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        // Build URL with optional page filter
        let url = `/api/document_content/${libraryId}/${documentId}`
        if (page !== null && page !== undefined) {
            url += `?page=${page}`
        }

        console.log('[DocumentViewer] Fetching:', url, { libraryId, documentId, page })

        fetch(url, { credentials: 'include' })
            .then(response => {
                console.log('[DocumentViewer] Response status:', response.status)
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `HTTP ${response.status}`)
                    }).catch(() => {
                        throw new Error(`HTTP ${response.status}: Failed to load document content`)
                    })
                }
                return response.json()
            })
            .then(result => {
                console.log('[DocumentViewer] Result:', result)
                if (result.error) {
                    throw new Error(result.error)
                }
                setData(result)
                setLoading(false)
            })
            .catch(err => {
                console.error('Document viewer error:', err)
                setError(err.message)
                setLoading(false)
            })
    }, [isOpen, libraryId, documentId, page])

    // Copy content to clipboard
    const handleCopy = useCallback(async (content: string, index: number) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedIndex(index)
            setTimeout(() => setCopiedIndex(null), 2000)
        } catch (err) {
            console.error('Copy error:', err)
        }
    }, [])

    // Toggle metadata expansion
    const toggleMetadata = useCallback((index: number) => {
        setExpandedMetadata(prev => {
            const next = new Set(prev)
            if (next.has(index)) {
                next.delete(index)
            } else {
                next.add(index)
            }
            return next
        })
    }, [])

    const displayName = data?.name || sourceName || 'Document'
    const displayPage = page !== null && page !== undefined ? ` (Page ${page})` : ''

    return (
        <Dialog open={isOpen} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b bg-muted/30">
                    <DialogTitle className="flex items-center gap-2 pr-8">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="truncate">{displayName}{displayPage}</span>
                        {data && (
                            <Badge variant="outline" className="ml-2 shrink-0">
                                {data.total_chunks} chunk{data.total_chunks !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 space-y-4">
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>Loading document content...</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex flex-col items-center justify-center py-12 text-destructive">
                                <p className="font-medium">Failed to load document</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                        )}

                        {data && data.chunks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <p>No content found for this document{page ? ` on page ${page}` : ''}.</p>
                            </div>
                        )}

                        {data && data.chunks.map((chunk, index) => (
                            <div
                                key={index}
                                className="rounded-lg border bg-card shadow-sm overflow-hidden"
                            >
                                {/* Chunk Header */}
                                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                                    <div className="flex items-center gap-2">
                                        {chunk.page && chunk.page !== 'N/A' && (
                                            <Badge variant="secondary" className="font-medium">
                                                Page {chunk.page}
                                            </Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            Chunk {index + 1}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleCopy(chunk.content, index)}
                                        title="Copy content"
                                    >
                                        {copiedIndex === index ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>

                                {/* Chunk Content */}
                                <div className="p-4">
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                                        {chunk.content}
                                    </pre>
                                </div>

                                {/* Metadata Toggle */}
                                {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                                    <div className="border-t">
                                        <button
                                            onClick={() => toggleMetadata(index)}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-primary hover:bg-muted/50 transition-colors"
                                        >
                                            {expandedMetadata.has(index) ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                            View Metadata
                                        </button>

                                        {expandedMetadata.has(index) && (
                                            <div className="px-4 pb-4">
                                                <pre className="p-3 bg-muted/50 rounded-md text-xs overflow-auto max-h-48 text-muted-foreground">
                                                    {JSON.stringify(chunk.metadata, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

export type { DocumentViewerProps, DocumentData, DocumentChunk }
