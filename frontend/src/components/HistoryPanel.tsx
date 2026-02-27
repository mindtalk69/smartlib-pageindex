import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/utils/cn'
import { Trash2, MessageSquare, Plus, History, MoreVertical } from 'lucide-react'
import { api } from '@/utils/apiClient'

interface Thread {
    id: string
    preview: string
    lastUpdated: string
    messageCount: number
}

interface HistoryPanelProps {
    currentThreadId: string | null
    onSelectThread: (threadId: string) => void
    onNewThread: () => void
}

interface GroupedThreads {
    label: string
    threads: Thread[]
}

/**
 * HistoryPanel Component
 * 
 * Sidebar showing conversation history with thread persistence.
 * Features: Date grouping, dropdown actions, improved UI.
 */
export function HistoryPanel({
    currentThreadId,
    onSelectThread,
    onNewThread
}: HistoryPanelProps) {
    const [threads, setThreads] = useState<Thread[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        fetchThreads()
    }, [])

    const fetchThreads = async () => {
        try {
            setLoading(true)
            const data = await api.get<any>('/threads')
            setThreads(data.threads || [])
            setError(null)
        } catch (err) {
            console.error('Failed to fetch threads:', err)
            setError(err instanceof Error ? err.message : 'Failed to load history')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteThread = async () => {
        if (!threadToDelete) return

        try {
            setIsDeleting(true)
            const data = await api.delete<any>(`/threads/${threadToDelete}`)
            if (!data.success) {
                throw new Error('Failed to delete thread')
            }

            // Remove from local state
            setThreads(prev => prev.filter(t => t.id !== threadToDelete))

            // If deleted thread was active, start new conversation
            if (currentThreadId === threadToDelete) {
                onNewThread()
            }
        } catch (err) {
            console.error('Failed to delete thread:', err)
            alert('Failed to delete conversation. Please try again.')
        } finally {
            setIsDeleting(false)
            setThreadToDelete(null)
        }
    }

    const formatDayLabel = (dateString: string): string => {
        const date = new Date(dateString)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const threadDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

        if (threadDate.getTime() === today.getTime()) {
            return 'Today'
        } else if (threadDate.getTime() === yesterday.getTime()) {
            return 'Yesterday'
        } else {
            // Return short date format
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
    }

    const formatTime = (dateString: string): string => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }

    const groupThreadsByDate = (): GroupedThreads[] => {
        const groups: { [key: string]: Thread[] } = {}

        threads.forEach(thread => {
            const label = formatDayLabel(thread.lastUpdated)
            if (!groups[label]) {
                groups[label] = []
            }
            groups[label].push(thread)
        })

        // Sort groups: Today, Yesterday, then by date descending
        const sortedLabels = Object.keys(groups).sort((a, b) => {
            if (a === 'Today') return -1
            if (b === 'Today') return 1
            if (a === 'Yesterday') return -1
            if (b === 'Yesterday') return 1
            return b.localeCompare(a)
        })

        return sortedLabels.map(label => ({
            label,
            threads: groups[label]
        }))
    }

    const groupedThreads = groupThreadsByDate()

    const truncateTitle = (title: string, limit: number = 30) => {
        if (title.length <= limit) return title
        return title.substring(0, limit) + "..."
    }

    return (
        <>
            {/* Toggle button */}
            <Button
                variant="outline"
                size="icon"
                className={cn(
                    "history-toggle fixed top-[88px] z-50 transition-all duration-300",
                    isOpen ? "left-[336px]" : "left-4"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <History className="h-4 w-4" />
            </Button>

            {/* Panel */}
            <div className={cn(
                "fixed left-0 top-0 bottom-0 w-80 bg-background border-r z-40 flex flex-col transition-transform duration-300",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Chat History
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNewThread}
                        title="New conversation"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-2">
                        {loading && (
                            <div className="text-center text-sm text-muted-foreground py-4">
                                Loading...
                            </div>
                        )}

                        {error && (
                            <div className="text-center text-sm text-destructive py-4">
                                {error}
                            </div>
                        )}

                        {!loading && !error && threads.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-4">
                                No conversations yet
                            </div>
                        )}

                        {!loading && groupedThreads.map((group, groupIndex) => (
                            <div key={group.label} className="mb-4">
                                {/* Date group label */}
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {group.label}
                                </div>

                                {/* Threads in this group */}
                                {group.threads.map(thread => (
                                    <div
                                        key={thread.id}
                                        className={cn(
                                            "group relative flex items-start gap-2 px-2 py-2 mb-1 rounded-lg transition-colors border border-transparent",
                                            "hover:bg-accent hover:border-border cursor-pointer",
                                            thread.id === currentThreadId && "bg-primary/10 border-primary/20"
                                        )}
                                        onClick={() => onSelectThread(thread.id)}
                                    >
                                        {/* Left icon */}
                                        <MessageSquare className={cn(
                                            "h-[13px] w-[13px] mt-[3px] flex-shrink-0",
                                            thread.id === currentThreadId ? "text-primary" : "text-muted-foreground"
                                        )} />

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Title (one line) with Tooltip */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={cn(
                                                        "font-medium text-[13px] mb-0.5 truncate",
                                                        thread.id === currentThreadId ? "text-primary" : "text-foreground"
                                                    )}>
                                                        {truncateTitle(thread.preview)}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="max-w-xs">
                                                    <p className="text-xs">{thread.preview}</p>
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Day label and time */}
                                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                                <span>{formatTime(thread.lastUpdated)}</span>
                                                <span>•</span>
                                                <span>{thread.messageCount} {thread.messageCount === 1 ? 'msg' : 'msgs'}</span>
                                            </div>
                                        </div>

                                        {/* Right menu */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-7 w-7 flex-shrink-0",
                                                        thread.id === currentThreadId
                                                            ? "opacity-100"
                                                            : "opacity-0 group-hover:opacity-100 transition-opacity"
                                                    )}
                                                >
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onSelectThread(thread.id)}>
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                    Open
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setThreadToDelete(thread.id)
                                                    }}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}

                                {/* Separator between groups (except last) */}
                                {groupIndex < groupedThreads.length - 1 && (
                                    <Separator className="my-2" />
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Deletion Confirmation Dialog */}
            <AlertDialog open={!!threadToDelete} onOpenChange={(open) => !open && setThreadToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the conversation history from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDeleteThread()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
