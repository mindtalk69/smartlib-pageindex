import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
} from "lucide-react";
import { LibraryKnowledgeSelector } from "./LibraryKnowledgeSelector";
import { DuplicateConfirmDialog } from "./DuplicateConfirmDialog";
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

interface FileUploadTabProps {
  libraries: Library[];
  vectorStoreMode: string;
  visualGroundingEnabled: boolean;
  isAdmin: boolean;
  onUploadStart: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  preview?: string;
}

export function FileUploadTab({
  libraries,
  vectorStoreMode,
  visualGroundingEnabled,
  isAdmin,
  onUploadStart,
}: FileUploadTabProps) {
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null,
  );
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<number | null>(
    null,
  );
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [enableVisualGrounding, setEnableVisualGrounding] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-500" />;
      case "doc":
      case "docx":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "xls":
      case "xlsx":
      case "csv":
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "tiff":
      case "bmp":
        return <FileImage className="h-5 w-5 text-purple-500" />;
      case "ppt":
      case "pptx":
        return <FileText className="h-5 w-5 text-orange-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const checkDuplicates = async () => {
    if (!selectedLibraryId) {
      toast.error("Library Required", {
        description: "Please select a library before uploading.",
      });
      return false;
    }

    if (vectorStoreMode === "knowledge" && !selectedKnowledgeId) {
      toast.error("Knowledge Required", {
        description: "Please select a knowledge base before uploading.",
      });
      return false;
    }

    try {
      const response = await fetch("/api/check-duplicates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          filenames: files.map((f) => f.file.name),
          library_id: selectedLibraryId,
          knowledge_id: selectedKnowledgeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.duplicates && data.duplicates.length > 0) {
          setDuplicates(data.duplicates);
          setShowDuplicateDialog(true);
          return false;
        }
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error);
    }

    return true;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("No Files Selected", {
        description: "Please select files to upload.",
      });
      return;
    }

    const canProceed = await checkDuplicates();
    if (!canProceed) return;

    await performUpload();
  };

  const performUpload = async () => {
    setIsUploading(true);

    try {
      const selectedLibrary = libraries.find(
        (lib) => lib.library_id === selectedLibraryId,
      );
      const libraryName = selectedLibrary?.name || "Unknown Library";

      let successCount = 0;
      let errorCount = 0;

      for (const uploadFile of files) {
        const formData = new FormData();
        formData.append("files", uploadFile.file);
        formData.append("library_id", String(selectedLibraryId));
        formData.append("library_name", libraryName);

        if (selectedKnowledgeId) {
          formData.append("knowledge_id", String(selectedKnowledgeId));
        }

        if (enableVisualGrounding && isAdmin && visualGroundingEnabled) {
          formData.append("enable_visual_grounding", "true");
        }

        try {
          const response = await fetch("/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            const data = await response.json();
            console.error(
              `Upload failed for ${uploadFile.file.name}:`,
              data.message,
            );
          }
        } catch (error) {
          errorCount++;
          console.error(`Upload error for ${uploadFile.file.name}:`, error);
        }
      }

      if (successCount > 0) {
        toast.success("Upload Complete", {
          description: `Successfully uploaded ${successCount} file(s). Processing started.`,
        });
        setFiles([]);
        onUploadStart();
      }

      if (errorCount > 0) {
        toast.error("Upload Errors", {
          description: `${errorCount} file(s) failed to upload.`,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    setShowDuplicateDialog(false);
    await performUpload();
  };

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

      {/* Drag & Drop Zone */}
      <motion.div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          scale: isDragging ? 1.02 : 1,
          borderColor: isDragging ? "rgb(59, 130, 246)" : "rgb(229, 231, 235)",
        }}
        transition={{ duration: 0.2 }}
        className={`
                    relative rounded-lg border-2 border-dashed p-12 text-center
                    transition-colors cursor-pointer
                    ${isDragging ? "bg-primary/5 border-primary" : "bg-muted/20 hover:bg-muted/40"}
                `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.md,.adoc,.asciidoc,.html,.xhtml,.csv,.png,.jpeg,.jpg,.tiff,.tif,.bmp,.txt,.odt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <motion.div
          animate={{ y: isDragging ? -10 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            {isDragging
              ? "Drop files here"
              : "Click to upload or drag and drop"}
          </p>
          <p className="text-sm text-muted-foreground">
            PDF, DOCX, XLSX, PPTX, MD, HTML, CSV, Images, and more
          </p>
        </motion.div>
      </motion.div>

      {/* Selected Files List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Selected Files ({files.length})
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="h-8 text-xs"
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              <AnimatePresence>
                {files.map((uploadFile) => (
                  <motion.div
                    key={uploadFile.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {getFileIcon(uploadFile.file.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.id)}
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Grounding Toggle (Admin Only) */}
      {isAdmin && visualGroundingEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
        >
          <div className="space-y-0.5">
            <Label htmlFor="visual-grounding" className="text-sm font-medium">
              Enable Visual Grounding
            </Label>
            <p className="text-xs text-muted-foreground">
              Generate layout data for image bounding boxes
            </p>
          </div>
          <Switch
            id="visual-grounding"
            checked={enableVisualGrounding}
            onCheckedChange={setEnableVisualGrounding}
          />
        </motion.div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading || !selectedLibraryId}
          className="min-w-[200px]"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload{" "}
              {files.length > 0
                ? `${files.length} File${files.length > 1 ? "s" : ""}`
                : "Files"}
            </>
          )}
        </Button>
      </div>

      {/* Duplicate Confirmation Dialog */}
      <DuplicateConfirmDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        duplicates={duplicates}
        onConfirm={handleDuplicateConfirm}
      />
    </div>
  );
}
