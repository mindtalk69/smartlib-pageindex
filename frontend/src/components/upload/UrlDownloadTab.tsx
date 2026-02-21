import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { LibraryKnowledgeSelector } from "./LibraryKnowledgeSelector";
import { toast } from "sonner";

interface Library {
  library_id: number;
  name: string;
  knowledges?: Knowledge[];
}

interface Knowledge {
  id: number;
  name: string;
  categories?: { id: number; name: string }[];
  catalogs?: { id: number; name: string }[];
  groups?: { group_id: number; name: string }[];
}

interface UrlDownloadTabProps {
  libraries: Library[];
  vectorStoreMode: string;
  onDownloadStart: () => void;
}

interface UrlItem {
  id: string;
  url: string;
  status: "pending" | "processing" | "success" | "error";
  message?: string;
}

export function UrlDownloadTab({
  libraries,
  vectorStoreMode,
  onDownloadStart,
}: UrlDownloadTabProps) {
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null,
  );
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<number | null>(
    null,
  );
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return "Invalid URL";
    }
  };

  const handleAddUrls = () => {
    const lines = urlInput
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const validUrls: UrlItem[] = [];
    const invalidUrls: string[] = [];

    lines.forEach((line) => {
      if (isValidUrl(line)) {
        // Check if URL already exists
        if (!urls.some((u) => u.url === line)) {
          validUrls.push({
            id: Math.random().toString(36).substr(2, 9),
            url: line,
            status: "pending",
          });
        }
      } else {
        invalidUrls.push(line);
      }
    });

    if (validUrls.length > 0) {
      setUrls((prev) => [...prev, ...validUrls]);
      setUrlInput("");
      toast.success("URLs Added", {
        description: `Added ${validUrls.length} valid URL${validUrls.length > 1 ? "s" : ""} to the queue.`,
      });
    }

    if (invalidUrls.length > 0) {
      toast.error("Invalid URLs", {
        description: `${invalidUrls.length} URL${invalidUrls.length > 1 ? "s were" : " was"} invalid and skipped.`,
      });
    }
  };

  const removeUrl = (id: string) => {
    setUrls((prev) => prev.filter((u) => u.id !== id));
  };

  const handleProcessUrls = async () => {
    if (urls.length === 0) {
      toast.error("No URLs", {
        description: "Please add URLs to download.",
      });
      return;
    }

    if (!selectedLibraryId) {
      toast.error("Library Required", {
        description: "Please select a library before downloading.",
      });
      return;
    }

    if (vectorStoreMode === "knowledge" && !selectedKnowledgeId) {
      toast.error("Knowledge Required", {
        description: "Please select a knowledge base before downloading.",
      });
      return;
    }

    setIsProcessing(true);

    const selectedLibrary = libraries.find(
      (lib) => lib.library_id === selectedLibraryId,
    );
    const libraryName = selectedLibrary?.name || "Unknown Library";

    let successCount = 0;
    let errorCount = 0;

    // Process URLs sequentially with status updates
    for (let i = 0; i < urls.length; i++) {
      const urlItem = urls[i];

      // Update status to processing
      setUrls((prev) =>
        prev.map((u) =>
          u.id === urlItem.id ? { ...u, status: "processing" as const } : u,
        ),
      );

      try {
        const response = await fetch("/api/process-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            url: urlItem.url,
            library_id: selectedLibraryId,
            library_name: libraryName,
            knowledge_id: selectedKnowledgeId,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          successCount++;
          setUrls((prev) =>
            prev.map((u) =>
              u.id === urlItem.id
                ? { ...u, status: "success" as const, message: data.message }
                : u,
            ),
          );
        } else {
          errorCount++;
          setUrls((prev) =>
            prev.map((u) =>
              u.id === urlItem.id
                ? {
                    ...u,
                    status: "error" as const,
                    message: data.message || "Download failed",
                  }
                : u,
            ),
          );
        }
      } catch (error) {
        errorCount++;
        setUrls((prev) =>
          prev.map((u) =>
            u.id === urlItem.id
              ? { ...u, status: "error" as const, message: "Network error" }
              : u,
          ),
        );
      }
    }

    setIsProcessing(false);
    onDownloadStart();

    if (successCount > 0) {
      toast.success("Download Complete", {
        description: `Successfully queued ${successCount} URL${successCount > 1 ? "s" : ""} for processing.`,
      });
    }

    if (errorCount > 0) {
      toast.error("Download Errors", {
        description: `${errorCount} URL${errorCount > 1 ? "s" : ""} failed to download.`,
      });
    }

    // Clear completed URLs after a delay
    setTimeout(() => {
      setUrls((prev) =>
        prev.filter((u) => u.status === "pending" || u.status === "processing"),
      );
    }, 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Globe className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "border-blue-500/50 bg-blue-500/5";
      case "success":
        return "border-green-500/50 bg-green-500/5";
      case "error":
        return "border-red-500/50 bg-red-500/5";
      default:
        return "bg-card hover:bg-accent/50";
    }
  };

  const canAddUrls = urlInput.trim().length > 0;
  const canProcess =
    urls.length > 0 && !isProcessing && selectedLibraryId !== null;

  return (
    <div className="space-y-6">
      {/* Library/Knowledge Selector */}
      <LibraryKnowledgeSelector
        libraries={libraries}
        vectorStoreMode={vectorStoreMode}
        selectedLibraryId={selectedLibraryId}
        selectedKnowledgeId={selectedKnowledgeId}
        onLibraryChange={setSelectedLibraryId}
        onKnowledgeChange={setSelectedKnowledgeId}
      />

      {/* URL Input */}
      <div className="space-y-3">
        <Label htmlFor="url-textarea" className="text-sm font-medium">
          Enter URLs
        </Label>
        <Textarea
          id="url-textarea"
          placeholder="Enter URLs, separated by commas or newlines...&#10;&#10;Example:&#10;https://example.com/document.pdf&#10;https://example.com/page.html"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          rows={5}
          className="resize-none"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Supported: HTTP and HTTPS URLs
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddUrls}
            disabled={!canAddUrls}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add to Queue
          </Button>
        </div>
      </div>

      {/* URL Queue List */}
      <AnimatePresence>
        {urls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                URL Queue ({urls.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUrls([])}
                disabled={isProcessing}
                className="h-8 text-xs"
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3 bg-muted/20">
              <AnimatePresence>
                {urls.map((urlItem, index) => (
                  <motion.div
                    key={urlItem.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.05,
                    }}
                    className={`
                                            flex items-start gap-3 p-3 rounded-lg border
                                            transition-all duration-200
                                            ${getStatusColor(urlItem.status)}
                                        `}
                  >
                    <div className="mt-0.5">
                      {getStatusIcon(urlItem.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate mb-1">
                        {extractDomain(urlItem.url)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {urlItem.url}
                      </p>
                      {urlItem.message && (
                        <p
                          className={`text-xs mt-1 ${
                            urlItem.status === "error"
                              ? "text-red-500"
                              : "text-green-600"
                          }`}
                        >
                          {urlItem.message}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        urlItem.status === "success"
                          ? "default"
                          : urlItem.status === "error"
                            ? "destructive"
                            : urlItem.status === "processing"
                              ? "secondary"
                              : "outline"
                      }
                      className="text-xs"
                    >
                      {urlItem.status}
                    </Badge>
                    {urlItem.status === "pending" && !isProcessing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUrl(urlItem.id)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleProcessUrls}
          disabled={!canProcess}
          className="min-w-[200px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download{" "}
              {urls.length > 0
                ? `${urls.length} URL${urls.length > 1 ? "s" : ""}`
                : "URLs"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
