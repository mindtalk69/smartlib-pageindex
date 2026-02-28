import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Loader2,
    CheckCircle2,
    XCircle,
    X,
    FileText,
} from 'lucide-react'
import api from '@/utils/apiClient'

interface UploadTask {
    task_id: string
    filename: string
    status: string
    info?: {
        stage?: string
        progress?: number
        message?: string
    }
}

interface UploadProgressProps {
    tasks: UploadTask[]
    onTaskComplete: (taskId: string) => void
}

export function UploadProgress({ tasks, onTaskComplete }: UploadProgressProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircle2 className="h-5 w-5 text-green-500" />
            case 'FAILURE':
                return <XCircle className="h-5 w-5 text-red-500" />
            case 'PENDING':
            case 'STARTED':
            case 'PROGRESS':
                return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            default:
                return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return 'border-green-500/30 bg-green-500/5'
            case 'FAILURE':
                return 'border-red-500/30 bg-red-500/5'
            case 'PENDING':
            case 'STARTED':
            case 'PROGRESS':
                return 'border-blue-500/30 bg-blue-500/5'
            default:
                return 'border-border bg-card'
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS':
                return <Badge variant="default" className="bg-green-500">Complete</Badge>
            case 'FAILURE':
                return <Badge variant="destructive">Failed</Badge>
            case 'PENDING':
                return <Badge variant="secondary">Queued</Badge>
            case 'STARTED':
                return <Badge variant="secondary">Started</Badge>
            case 'PROGRESS':
                return <Badge variant="secondary">Processing</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getProgress = (task: UploadTask): number => {
        if (task.status === 'SUCCESS') return 100
        if (task.status === 'FAILURE') return 0
        if (task.info?.progress) return task.info.progress
        if (task.status === 'STARTED') return 25
        if (task.status === 'PROGRESS') return 50
        return 0
    }

    const handleDismiss = async (taskId: string) => {
        try {
            await api.post(`/upload-status/${taskId}/dismiss`);
            onTaskComplete(taskId)
        } catch (error) {
            console.error('Failed to dismiss task:', error)
        }
    }

    if (tasks.length === 0) return null

    return (
        <Card className="shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Processing Files
                    <Badge variant="secondary" className="ml-auto">
                        {tasks.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    <AnimatePresence>
                        {tasks.map((task, index) => (
                            <motion.div
                                key={task.task_id}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 100 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.05,
                                }}
                                className={`
                                    p-4 rounded-lg border transition-all
                                    ${getStatusColor(task.status)}
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {getStatusIcon(task.status)}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <span className="text-sm font-medium truncate">
                                                    {task.filename}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {getStatusBadge(task.status)}
                                                {(task.status === 'SUCCESS' || task.status === 'FAILURE') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handleDismiss(task.task_id)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        {task.status !== 'SUCCESS' && task.status !== 'FAILURE' && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.2 }}
                                            >
                                                <Progress
                                                    value={getProgress(task)}
                                                    className="h-2"
                                                />
                                            </motion.div>
                                        )}

                                        {/* Stage/Message Info */}
                                        {task.info && (task.info.stage || task.info.message) && (
                                            <p className="text-xs text-muted-foreground">
                                                {task.info.stage || task.info.message}
                                            </p>
                                        )}

                                        {/* Error Message */}
                                        {task.status === 'FAILURE' && task.info?.message && (
                                            <p className="text-xs text-red-500">
                                                Error: {task.info.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    )
}
