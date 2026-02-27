import { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  Check,
  X,
  Loader2,
  RefreshCw,
  FileUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Link } from "react-router-dom";
import api from "@/utils/apiClient";

interface UploadTask {
  task_id: string;
  filename: string;
  status: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";
  progress?: number;
  stage?: string;
  error?: string;
  completed_at?: string;
}

interface UploadStatusBadgeProps {
  className?: string;
}

/**
 * UploadStatusBadge Component
 *
 * Navbar badge showing real-time upload/processing status.
 * Polls /api/upload-status every 5 seconds for active tasks.
 */
export function UploadStatusBadge({ className }: UploadStatusBadgeProps) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<{ tasks: UploadTask[] }>("/upload-status");
      setTasks(data.tasks || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch upload status:", err);
    }
  }, []);

  // Poll every 5 seconds when there are active tasks
  useEffect(() => {
    if (!isPolling) return;

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, [isPolling, fetchStatus]);

  // Stop polling when no active tasks for 10 seconds
  useEffect(() => {
    const activeTasks = tasks.filter(
      (t) => t.status === "PENDING" || t.status === "PROGRESS",
    );
    if (activeTasks.length === 0 && tasks.length > 0) {
      const timeout = setTimeout(() => setIsPolling(false), 10000);
      return () => clearTimeout(timeout);
    } else if (activeTasks.length > 0) {
      setIsPolling(true);
    }
  }, [tasks]);

  const dismissTask = async (taskId: string) => {
    try {
      await api.post(`/api/upload-status/${taskId}/dismiss`);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err) {
      console.error("Failed to dismiss task:", err);
    }
  };

  const activeTasks = tasks.filter(
    (t) => t.status === "PENDING" || t.status === "PROGRESS",
  );
  const completedTasks = tasks.filter(
    (t) => t.status === "SUCCESS" || t.status === "FAILURE",
  );

  const hasActiveTasks = activeTasks.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
        >
          <Upload className="h-4 w-4" />
          {hasActiveTasks && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
            >
              {activeTasks.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Upload Status</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fetchStatus()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="max-h-72">
          {tasks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No recent uploads
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {/* Active tasks */}
              {activeTasks.map((task) => (
                <div
                  key={task.task_id}
                  className="p-2 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium truncate flex-1">
                      {task.filename}
                    </span>
                  </div>
                  {task.stage && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {task.stage}
                    </div>
                  )}
                  {task.progress !== undefined && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.progress}%
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Completed tasks */}
              {completedTasks.map((task) => (
                <div
                  key={task.task_id}
                  className={cn(
                    "p-2 rounded-lg border flex items-center justify-between",
                    task.status === "SUCCESS"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-destructive/10 border-destructive/30",
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {task.status === "SUCCESS" ? (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {task.filename}
                      </span>
                      {task.error && (
                        <span className="text-xs text-destructive truncate block">
                          {task.error}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => dismissTask(task.task_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DropdownMenuSeparator />

        <div className="px-3 py-2">
          <Link
            to="/upload"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileUp className="h-4 w-4" />
            Go to Upload Page
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="px-3 py-1 text-xs text-muted-foreground">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
