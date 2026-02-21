import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getCsrfTokenSync } from "@/utils/csrf";

import { Info, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Library {
  library_id: number;
  name: string;
  knowledges?: Knowledge[];
}

interface Knowledge {
  id: number;
  name: string;
  embedding_model?: string;
  categories?: { id: number; name: string }[];
  catalogs?: { id: number; name: string }[];
  groups?: { group_id: number; name: string }[];
}

interface LibraryKnowledgeSelectorProps {
  libraries: Library[];
  vectorStoreMode: string;
  selectedLibraryId: number | null;
  selectedKnowledgeId: number | null;
  onLibraryChange: (id: number | null) => void;
  onKnowledgeChange: (id: number | null) => void;
}

interface EmbeddingCompatibility {
  compatible: boolean;
  message: string;
  current_model: string;
  current_dimension: number;
  knowledge_model?: string;
  knowledge_dimension?: number;
}

export function LibraryKnowledgeSelector({
  libraries,
  vectorStoreMode,
  selectedLibraryId,
  selectedKnowledgeId,
  onLibraryChange,
  onKnowledgeChange,
}: LibraryKnowledgeSelectorProps) {
  const [metadataInfo, setMetadataInfo] = useState<string>("");
  const [embeddingInfo, setEmbeddingInfo] = useState<EmbeddingCompatibility | null>(null);
  const [checkingEmbedding, setCheckingEmbedding] = useState(false);

  useEffect(() => {
    updateMetadataInfo();
    checkEmbeddingCompatibility();
  }, [selectedLibraryId, selectedKnowledgeId]);

  const checkEmbeddingCompatibility = async () => {
    if (!selectedKnowledgeId) {
      setEmbeddingInfo(null);
      return;
    }

    setCheckingEmbedding(true);
    try {
      const response = await fetch("/api/embedding-compatibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfTokenSync(),
        },
        credentials: "include",
        body: JSON.stringify({ knowledge_id: selectedKnowledgeId }),
      });

      if (response.ok) {
        const data = await response.json();
        setEmbeddingInfo(data);
      }
    } catch (error) {
      console.error("Failed to check embedding compatibility:", error);
    } finally {
      setCheckingEmbedding(false);
    }
  };

  const updateMetadataInfo = () => {
    if (!selectedLibraryId) {
      setMetadataInfo("");
      return;
    }

    const library = libraries.find(
      (lib) => lib.library_id === selectedLibraryId,
    );
    if (!library) {
      setMetadataInfo("");
      return;
    }

    let knowledge: Knowledge | undefined;

    if (selectedKnowledgeId) {
      knowledge = library.knowledges?.find((k) => k.id === selectedKnowledgeId);
    } else if (library.knowledges && library.knowledges.length > 0) {
      knowledge = library.knowledges[0];
    }

    if (knowledge) {
      const parts: string[] = [];

      if (knowledge.categories && knowledge.categories.length > 0) {
        const categoryNames = knowledge.categories
          .map((c) => c.name)
          .join(", ");
        parts.push(`Categories: ${categoryNames}`);
      }

      if (knowledge.catalogs && knowledge.catalogs.length > 0) {
        const catalogNames = knowledge.catalogs.map((c) => c.name).join(", ");
        parts.push(`Catalogs: ${catalogNames}`);
      }

      if (knowledge.groups && knowledge.groups.length > 0) {
        const groupNames = knowledge.groups.map((g) => g.name).join(", ");
        parts.push(`Groups: ${groupNames}`);
      }

      setMetadataInfo(parts.join(" • "));
    } else {
      setMetadataInfo("");
    }
  };

  const handleLibraryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (!value) {
      onLibraryChange(null);
      onKnowledgeChange(null);
      return;
    }

    // Parse composite value "libraryId:knowledgeId"
    const [libraryIdStr, knowledgeIdStr] = value.split(":");
    const libraryId = parseInt(libraryIdStr);
    const knowledgeId = knowledgeIdStr ? parseInt(knowledgeIdStr) : null;

    onLibraryChange(libraryId);
    onKnowledgeChange(knowledgeId);
  };

  const getModeDescription = () => {
    switch (vectorStoreMode) {
      case "user":
        return "Per User Mode: Private storage for each user";
      case "global":
        return "Global Mode: Shared storage across all users";
      case "knowledge":
        return "Knowledge Mode: Grouped by Knowledge Base (required)";
      default:
        return `Mode: ${vectorStoreMode}`;
    }
  };

  // Get embedding model name for display
  const getModelDisplayName = (model?: string) => {
    if (!model) return "Not set";
    if (model.includes("Qwen")) return "Qwen3-Embedding (1024d)";
    if (model.includes("bge-m3")) return "BGE-M3 (1024d)";
    if (model.includes("text-embedding")) return "OpenAI (1536d)";
    return model;
  };

  // Build library options with knowledge names
  const libraryOptions = libraries.flatMap((library) => {
    if (library.knowledges && library.knowledges.length > 0) {
      return library.knowledges.map((knowledge) => ({
        library_id: library.library_id,
        library_name: library.name,
        knowledge_id: knowledge.id,
        knowledge_name: knowledge.name,
        display_name: `${library.name} — ${knowledge.name}`,
        composite_value: `${library.library_id}:${knowledge.id}`,
        knowledge,
      }));
    } else {
      return [
        {
          library_id: library.library_id,
          library_name: library.name,
          knowledge_id: 0,
          knowledge_name: "",
          display_name: library.name,
          composite_value: `${library.library_id}:`,
          knowledge: null as Knowledge | null,
        },
      ];
    }
  });

  // Build the current composite value from selected IDs
  const currentValue = selectedLibraryId
    ? `${selectedLibraryId}:${selectedKnowledgeId || ""}`
    : "";

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="library-select" className="text-sm font-medium">
            Select Library
            {vectorStoreMode === "knowledge" && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{getModeDescription()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <select
          id="library-select"
          value={currentValue}
          onChange={handleLibraryChange}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required={vectorStoreMode === "knowledge"}
        >
          <option value="">Choose a library...</option>
          {libraryOptions.map((option, index) => (
            <option
              key={`${option.library_id}-${option.knowledge_id || index}`}
              value={option.composite_value}
            >
              {option.display_name}
            </option>
          ))}
        </select>

        {metadataInfo && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {metadataInfo.split(" • ").map((part, index) => (
              <Badge key={index} variant="outline" className="text-xs font-normal">
                {part}
              </Badge>
            ))}
          </div>
        )}

        {vectorStoreMode === "knowledge" && !selectedLibraryId && (
          <p className="text-xs text-red-500 mt-1">
            Knowledge mode requires a library selection
          </p>
        )}
      </div>

      {/* Embedding Model Information */}
      {selectedKnowledgeId && (
        <div className="space-y-2 mt-4 pt-4 border-t">
          {checkingEmbedding ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
              Checking embedding model...
            </div>
          ) : embeddingInfo ? (
            <>
              {/* Compatible */}
              {embeddingInfo.compatible && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <Info className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-xs">
                    <div className="font-medium text-green-900 dark:text-green-100">
                      Embedding Model
                    </div>
                    <div className="text-green-700 dark:text-green-300 mt-1">
                      <strong>{getModelDisplayName(embeddingInfo.knowledge_model)}</strong>
                      {embeddingInfo.knowledge_model ? (
                        <span> • {embeddingInfo.knowledge_dimension}d • Compatible with current default</span>
                      ) : (
                        <span> • Will use default: <strong>{getModelDisplayName(embeddingInfo.current_model)}</strong> ({embeddingInfo.current_dimension}d)</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Incompatible */}
              {!embeddingInfo.compatible && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-red-900 dark:text-red-100 mb-1">
                        ⚠️ Embedding Dimension Mismatch
                      </div>
                      <div className="text-red-700 dark:text-red-300 mb-2">
                        This knowledge base uses <strong>{getModelDisplayName(embeddingInfo.knowledge_model)}</strong> ({embeddingInfo.knowledge_dimension}d),
                        but the current default is <strong>{getModelDisplayName(embeddingInfo.current_model)}</strong> ({embeddingInfo.current_dimension}d).
                      </div>
                      <div className="text-red-700 dark:text-red-300 text-xs">
                        <strong>Search will fail!</strong> To fix this:
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          <li>Delete all documents from this knowledge base</li>
                          <li>Re-upload (will use the new model)</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
