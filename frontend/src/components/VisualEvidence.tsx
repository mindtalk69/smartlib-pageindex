import { useEffect, useState, useCallback } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Download, Copy, Eye, Loader2, FileImage, ZoomIn, ZoomOut } from "lucide-react"
import { api } from '@/utils/apiClient'

interface VisualEvidenceData {
    doclingJsonPath: string
    pageNo: number
    bbox: string
    documentId: string
    source?: string
}

interface VisualEvidenceModalProps {
    evidence: VisualEvidenceData | null
    onClose: () => void
}

/**
 * VisualEvidence Modal Component
 * 
 * Displays visual grounding evidence from documents with highlighted regions.
 * Uses shadcn/ui Dialog for consistent styling.
 */

/**
 * VisualEvidence Content Component
 * 
 * Reusable component that handles fetching and displaying visual evidence images.
 * Can be used inside a Modal or a Panel.
 */
export function VisualEvidenceContent({ evidence }: { evidence: VisualEvidenceData }) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [zoom, setZoom] = useState(100) // Zoom percentage: 50% to 200%

    // Fetch evidence image when evidence changes
    useEffect(() => {
        if (!evidence) {
            setImageUrl(null)
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
            docling_json_path: evidence.doclingJsonPath,
            page_no: String(evidence.pageNo),
            bbox: evidence.bbox,
            document_id: evidence.documentId,
        })

        api.get<Blob>(`/visual_evidence?${params}`, { responseType: 'blob' })
            .then(blob => {
                const url = URL.createObjectURL(blob)
                setImageUrl(url)
                setLoading(false)
            })
            .catch(err => {
                console.error('Visual evidence error:', err)
                setError(err.message)
                setLoading(false)
            })

        // Cleanup blob URL on unmount or evidence change
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl)
            }
        }
    }, [evidence])

    const handleDownload = useCallback(() => {
        if (!imageUrl) return

        const a = document.createElement('a')
        a.href = imageUrl
        a.download = `evidence-page-${evidence?.pageNo || 'unknown'}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }, [imageUrl, evidence?.pageNo])

    const handleCopy = useCallback(async () => {
        if (!imageUrl) return

        try {
            const response = await fetch(imageUrl)
            const blob = await response.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ])
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Copy image error:', err)
        }
    }, [imageUrl])

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 25, 200))
    }, [])

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 25, 50))
    }, [])

    const handleZoomReset = useCallback(() => {
        setZoom(100)
    }, [])

    return (
        <div className="flex-1 flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-auto min-h-0 flex flex-col">
                {loading && (
                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>Loading visual evidence...</p>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-destructive">
                        <p className="font-medium">Failed to load evidence</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                )}

                {imageUrl && !loading && (
                    <div className="flex justify-center p-4 bg-muted/30 rounded-lg flex-1 items-center min-h-0 overflow-auto">
                        <img
                            src={imageUrl}
                            alt="Visual evidence"
                            className="max-w-full max-h-full object-contain rounded border shadow-sm"
                            style={{
                                transform: `scale(${zoom / 100})`,
                                transition: 'transform 0.2s ease-in-out',
                                transformOrigin: 'center center'
                            }}
                        />
                    </div>
                )}

                {evidence && !loading && !error && (
                    <div className="flex flex-wrap gap-4 mt-4 text-sm shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Source:</span>
                            <Badge variant="secondary" className="font-normal">
                                {evidence.source || evidence.documentId}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Page:</span>
                            <Badge variant="outline">{evidence.pageNo}</Badge>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 mt-4 shrink-0">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={!imageUrl || loading || zoom <= 50}
                    title="Zoom out"
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    onClick={handleZoomReset}
                    disabled={!imageUrl || loading}
                    title="Reset zoom"
                    className="min-w-[60px]"
                >
                    {zoom}%
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={!imageUrl || loading || zoom >= 200}
                    title="Zoom in"
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    onClick={handleCopy}
                    disabled={!imageUrl || loading}
                >
                    <Copy className="h-4 w-4 mr-2" />
                    {copied ? "Copied!" : "Copy Image"}
                </Button>
                <Button
                    onClick={handleDownload}
                    disabled={!imageUrl || loading}
                >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                </Button>
            </div>
        </div>
    )
}

/**
 * VisualEvidence Modal Component
 * 
 * Displays visual grounding evidence in a Dialog.
 * Wraps VisualEvidenceContent.
 */
export function VisualEvidenceModal({ evidence, onClose }: VisualEvidenceModalProps) {
    return (
        <Dialog open={!!evidence} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileImage className="h-5 w-5" />
                        Visual Evidence
                    </DialogTitle>
                    <DialogDescription>
                        Highlighted region from source document
                    </DialogDescription>
                </DialogHeader>

                {evidence && <VisualEvidenceContent evidence={evidence} />}
            </DialogContent>
        </Dialog>
    )
}

/**
 * VisualEvidence Button Component
 * 
 * Clickable button that appears next to citations with visual grounding.
 */
interface VisualEvidenceButtonProps {
    evidence: VisualEvidenceData
    onClick: (evidence: VisualEvidenceData) => void
}

export function VisualEvidenceButton({ evidence, onClick }: VisualEvidenceButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                        e.stopPropagation()
                        onClick(evidence)
                    }}
                >
                    <Eye className="h-3.5 w-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>View visual evidence</p>
            </TooltipContent>
        </Tooltip>
    )
}

export type { VisualEvidenceData }
