import { useState, FormEvent, useCallback, useEffect, useRef } from "react";
import { HistoryPanel } from "./components/HistoryPanel";
import {
  VisualEvidenceModal,
  VisualEvidenceButton,
} from "./components/VisualEvidence";
import { DocumentViewer } from "./components/DocumentViewer";
import { KnowledgeSelector } from "./components/KnowledgeSelector";
// import { ModelSelector } from "./components/ModelSelector"; // Hidden for now
import { FileAttachment } from "./components/FileAttachment";
import { SettingsPanel, ThemeToggle } from "./components/SettingsPanel";
import { NavigationMenu } from "./components/NavigationMenu";
import { ActionMenu } from "./components/ActionMenu";
import { UploadStatusBadge } from "./components/UploadStatusBadge";
import { SuggestedQuestions } from "./components/SuggestedQuestions";
import { ViewModeToggle, ViewMode } from "./components/ViewModeToggle";
import { LiveDisplay } from "./components/LiveDisplay";
import { CustomSidebar } from "./components/CustomSidebar";
import { ThinkingAnimation } from "./components/ThinkingAnimation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Settings,
  MessageCircle,
  BookOpen,
  AlertTriangle,
  Send,
  Wand2,
  Loader2,
  Check,
  Clock,
  FileText,
  MessagesSquare,
  Copy,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { VisualEvidenceData } from "./components/VisualEvidence";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Phase 2: Live Content Types
export type ImageContent = { type: 'image'; data: VisualEvidenceData };
export type MapContent = { type: 'map'; htmlUrl?: string; imageUrl?: string };
export type ChartContent = { type: 'chart'; base64: string; mimeType: string };
export type DataSampleContent = {
  type: 'data_sample';
  columns: string[];
  data: any[][];
  totalRows: number;
  filename: string;
};
export type ActiveContent = ImageContent | MapContent | ChartContent | DataSampleContent;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  suggestedQuestions?: string[];
  chartData?: {
    base64: string;
    mimeType?: string;
  };
  tableData?: {
    columns: string[];
    data: any[][];
    totalRows: number;
    filename: string;
  };
  mapData?: {
    htmlUrl?: string;
    imageBase64?: string;
    imageMimeType?: string;
  };
  usageMetadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  timestamp?: Date;
  // User attached image
  imageData?: {
    base64: string;
    mimeType: string;
  };
  // HIL (Human-in-the-Loop) confirmation options
  hilOptions?: Array<{ display_text: string; payload: string }>;
  confirmationRequired?: boolean;
  confirmationType?: string;
}

interface Citation {
  source: string;
  page?: number;  // Backend sends "page"
  pageNo?: number;  // Alternative field name
  bbox?: string | number[];  // API format [x, y, w, h]
  raw_bbox?: { l: number; t: number; r: number; b: number; coord_origin?: string };  // Dict format for API
  doclingJsonPath?: string;
  docling_json_path?: string;  // Backend uses snake_case
  documentId?: string;
  document_id?: string;  // Backend may use snake_case
  library_id?: number;
  has_visual_evidence?: boolean;  // Backend flag
}



interface UploadStatus {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

/**
 * SmartLib Chat v2.0
 *
 * Full-featured React chat interface with:
 * - VisualEvidence, HistoryPanel
 * - Knowledge/Library selector
 * - File attachments
 * - Theme settings
 * - Upload status
 */
export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  // Refs to track attached charts/tables (sync updates to avoid race conditions)
  const attachedChartBase64s = useRef<Set<string>>(new Set());
  const attachedTableFilenames = useRef<Set<string>>(new Set());

  // Track which messages have chart/table data attached to prevent duplicates
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>(
    () => localStorage.getItem("smartlib_thread_id") || `thread-${Date.now()}`,
  );
  const [selectedEvidence, setSelectedEvidence] =
    useState<VisualEvidenceData | null>(null);

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{
    libraryId: number;
    documentId: string;
    page?: number;
    sourceName?: string;
  } | null>(null);

  // Knowledge/Library filters - with persistence
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<number | null>(() => {
    const saved = localStorage.getItem("smartlib_selected_knowledge");
    return saved ? parseInt(saved, 10) : null;
  });
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(() => {
    const saved = localStorage.getItem("smartlib_selected_library");
    return saved ? parseInt(saved, 10) : null;
  });

  // Knowledge-library mapping for filtering
  const [knowledgeLibrariesMap, setKnowledgeLibrariesMap] = useState<{
    [knowledgeId: string]: { name: string; libraries: { id: number; name: string }[] }
  }>({});
  // Model selection state with localStorage persistence
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  // Load model preference from localStorage or fetch system default on mount
  useEffect(() => {
    const savedModelId = localStorage.getItem('preferred_model_id');

    if (savedModelId) {
      // User has a saved preference
      setSelectedModelId(parseInt(savedModelId));
    } else {
      // First-time user: fetch system default from backend
      fetch('/admin/models/api/default', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.model_id) {
            setSelectedModelId(data.model_id);
          }
        })
        .catch(err => console.error('Failed to fetch default model:', err));
    }
  }, []);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);

  // Excel sheet selection (Phase 2B)
  const [selectedExcelSheets, setSelectedExcelSheets] = useState<string[]>([]);

  // File validation errors (Phase 2B)
  const [fileError, /*setFileError*/] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);

  // View mode (classic or sidebar) - with persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("smartlib_view_mode");
    console.log('[App INIT] Loading viewMode from localStorage:', saved);
    const mode = (saved === "sidebar" || saved === "classic") ? saved : "classic";
    console.log('[App INIT] Initializing viewMode to:', mode);
    return mode;
  });
  const [activeContent, setActiveContent] = useState<ActiveContent | null>(() => {
    // Check if chat restoration is enabled (default: false)
    const restoreChat = localStorage.getItem("smartlib_restore_chat");
    if (restoreChat !== "true") {
      console.log('[App INIT] Chat restoration disabled (default), clearing activeContent');
      // Clear persisted activeContent when restore chat is disabled
      localStorage.removeItem("smartlib_active_content");
      return null;
    }

    // Otherwise, restore activeContent from localStorage
    const saved = localStorage.getItem("smartlib_active_content");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("smartlib_view_mode", mode);

    // When switching to sidebar, sync map data from the last assistant message
    if (mode === 'sidebar') {
      const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop();
      if (lastAssistantMsg?.mapData) {
        console.log('[View Sync] Syncing map to sidebar from last message:', lastAssistantMsg.mapData);
        setActiveContent({
          type: 'map',
          htmlUrl: lastAssistantMsg.mapData.htmlUrl,
          imageUrl: lastAssistantMsg.mapData.imageBase64
            ? `data:${lastAssistantMsg.mapData.imageMimeType};base64,${lastAssistantMsg.mapData.imageBase64}`
            : undefined
        });
      }
    }
  }, [messages]);

  // Model selector hidden for now
  // const handleModelChange = useCallback((modelId: number) => {
  //   // Save to localStorage for persistence across sessions
  //   localStorage.setItem('preferred_model_id', modelId.toString());
  //   setSelectedModelId(modelId);
  // }, []);

  // Upload status
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  // Branding (logo, app name)
  const [branding, setBranding] = useState<{
    logo_url?: string;
    app_name?: string;
  }>({});

  // Notification/Toast state
  const [notification, setNotification] = useState<string | null>(null);

  // Self-retriever suggested questions
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Textarea ref for clipboard paste
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ref for auto-scroll to latest message
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User stats (message count, document count)
  const [userStats, setUserStats] = useState({ messageCount: 0, docsCount: 0 });

  // User info (username, isAdmin, profilePictureUrl)
  const [username, setUsername] = useState<string>("User");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("smartlib_theme");
    if (savedTheme && savedTheme !== "system") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  // Fetch branding (logo, app name) and user config
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch("/api/branding");
        if (response.ok) {
          const data = await response.json();
          setBranding(data);
        }
      } catch (err) {
        console.error("Failed to fetch branding:", err);
      }
    };

    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/me", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setUsername(data.user.username || "User");
            setIsAdmin(data.user.is_admin || false);
            setProfilePictureUrl(data.user.profile_picture_url || null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    };

    const fetchKnowledgeLibrariesMap = async () => {
      try {
        const response = await fetch("/api/knowledges", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setKnowledgeLibrariesMap(data.knowledge_libraries_map || {});
        }
      } catch (err) {
        console.error("Failed to fetch knowledge-library mapping:", err);
      }
    };

    fetchBranding();
    fetchConfig();
    fetchKnowledgeLibrariesMap();
  }, []);

  // Persist thread ID
  useEffect(() => {
    localStorage.setItem("smartlib_thread_id", threadId);
  }, [threadId]);

  // Auto-scroll to latest message when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, viewMode]);

  // Fetch user stats (message count, document count)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/counters", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUserStats({
            messageCount: data.message_count || 0,
            docsCount: data.uploaded_docs_count || 0,
          });
        }
      } catch (err) {
        console.error("Failed to fetch user stats:", err);
      }
    };
    fetchStats();
  }, [messages]); // Refetch when messages change

  // Restore chat history on mount if enabled (default: disabled)
  useEffect(() => {
    const restoreChat = localStorage.getItem("smartlib_restore_chat");
    console.log('[App] Restore chat setting:', restoreChat);
    if (restoreChat !== "true") {
      console.log('[App] Chat restoration disabled (default)');
      return; // Not explicitly enabled
    }

    const fetchHistory = async () => {
      try {
        console.log('[App] Fetching chat history from /api/history');
        const response = await fetch(`/api/history`, {
          credentials: "include",
        });
        console.log('[App] History response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[App] History data received:', data);

          if (data.success && data.history) {
            // Flatten date-grouped history into messages array
            const restoredMessages: Message[] = [];

            // Sort dates chronologically
            const sortedDates = Object.keys(data.history).sort();
            console.log('[App] Processing dates:', sortedDates);

            for (const date of sortedDates) {
              const dayMessages = data.history[date];
              console.log(`[App] Date ${date} has ${dayMessages.length} messages`);

              for (const msg of dayMessages) {
                // Skip messages with no content or invalid role
                if (!msg.message_text || !msg.message_text.trim()) {
                  console.log('[App] Skipping message with empty content:', msg.message_id);
                  continue;
                }
                if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
                  console.log('[App] Skipping message with invalid role:', msg.message_id, msg.role);
                  continue;
                }

                restoredMessages.push({
                  id: msg.message_id?.toString() || `${Date.now()}-${Math.random()}`,
                  role: msg.role as "user" | "assistant",
                  content: msg.message_text.trim(),
                  citations: Array.isArray(msg.citations) ? msg.citations : [],
                  suggestedQuestions: Array.isArray(msg.suggested_questions) ? msg.suggested_questions : [],
                  usageMetadata: msg.usage_metadata,
                  timestamp: msg.timestamp ? new Date(`${date} ${msg.timestamp}`) : undefined,
                });
              }
            }

            console.log(`[App] Restored ${restoredMessages.length} valid messages from history`);
            console.log('[App] First few messages:', restoredMessages.slice(0, 3));
            setMessages(restoredMessages);
          } else {
            console.log('[App] No history data or unsuccessful response:', data);
          }
        } else {
          console.error('[App] History fetch failed with status:', response.status);
        }
      } catch (err) {
        console.error("[App] Failed to restore chat history:", err);
      }
    };

    fetchHistory();
  }, []); // Run only on mount

  // Debug: Log messages changes
  useEffect(() => {
    console.log('[App] Messages state changed, length:', messages.length);
    if (messages.length > 0) {
      console.log('[App] First message:', messages[0]);
    }
  }, [messages]);

  // Persist viewMode changes
  useEffect(() => {
    localStorage.setItem("smartlib_view_mode", viewMode);
  }, [viewMode]);

  // Debug logging for viewMode
  useEffect(() => {
    console.log('[App] viewMode changed to:', viewMode);
    console.log('[App] localStorage viewMode:', localStorage.getItem('smartlib_view_mode'));
  }, [viewMode]);

  // Persist activeContent changes
  useEffect(() => {
    if (activeContent) {
      localStorage.setItem("smartlib_active_content", JSON.stringify(activeContent));
    }
  }, [activeContent]);

  // Persist knowledge/library selection
  useEffect(() => {
    if (selectedKnowledgeId !== null) {
      localStorage.setItem("smartlib_selected_knowledge", selectedKnowledgeId.toString());
    }
  }, [selectedKnowledgeId]);

  useEffect(() => {
    if (selectedLibraryId !== null) {
      localStorage.setItem("smartlib_selected_library", selectedLibraryId.toString());
    }
  }, [selectedLibraryId]);

  // Fallback message: Show generic status if no progress events arrive within 5 seconds
  useEffect(() => {
    if (isLoading && !agentStatus) {
      const fallbackTimer = setTimeout(() => {
        setAgentStatus("Processing your request...");
      }, 5000);

      return () => clearTimeout(fallbackTimer);
    }
  }, [isLoading, agentStatus]);


  // HIL (Human-in-the-Loop) response handler
  const handleHilResponse = useCallback(async (messageId: string, payload: string) => {
    console.log('[HIL] User response:', { messageId, payload });
    setIsLoading(true);

    try {
      // Send the confirmation to backend
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: payload, // "yes" or "no"
          thread_id: threadId,
          stream: true,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          knowledge_id: selectedKnowledgeId,
          library_id: selectedLibraryId,
        }),
      });

      console.log('[SSE] Response status:', response.status, 'ok:', response.ok);
      console.log('[SSE] Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('[SSE] Response body type:', typeof response.body, 'body:', response.body);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update the original message to remove HIL options (already answered)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, hilOptions: undefined, confirmationRequired: false }
            : m
        )
      );

      const reader = response.body?.getReader();
      console.log('[SSE] Reader created:', !!reader);
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        console.log('[SSE] Starting to read stream...');
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        let buffer = "";

        let chunkCount = 0;
        while (true) {
          const { done, value } = await reader.read();
          chunkCount++;
          if (chunkCount <= 5) {
            console.log(`[SSE] Chunk #${chunkCount}:`, { done, hasValue: !!value, valueLength: value?.length });
          }
          if (done) {
            console.log('[SSE] Stream complete, total chunks:', chunkCount);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              console.log('[SSE RAW]', line.slice(0, 150));
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "text_chunk" && data.content) {
                  assistantContent += data.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                } else if (data.type === "agent_progress" && data.status) {
                  console.log('[SSE] agent_progress:', data.status);
                  setAgentStatus(data.status);
                } else if (data.type === "end_of_stream" && data.data) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                          ...m,
                          content: data.data.answer || m.content,
                          citations: data.data.citations || m.citations,
                          suggestedQuestions: data.data.suggested_questions || m.suggestedQuestions,
                        }
                        : m
                    )
                  );
                  setAgentStatus(null);
                } else if (data.type === "metadata_update" && data.metadata) {
                  if (data.metadata.answer) {
                    assistantContent = data.metadata.answer;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id
                          ? { ...m, content: assistantContent }
                          : m
                      )
                    );
                  }
                }
              } catch (e) {
                console.debug("Skipped SSE line:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error during query:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setAgentStatus(null); // Clear progress status on error
    } finally {
      setIsLoading(false);
      setAgentStatus(null); // Clear progress status when done
    }
  }, [threadId, messages, selectedKnowledgeId, selectedLibraryId]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      // Include attached image in user message
      imageData: imageBase64 && imageMimeType ? {
        base64: imageBase64,
        mimeType: imageMimeType,
      } : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    setAgentStatus(null); // Clear any previous status

    try {
      // Determine file type
      const fileType = attachedFile
        ? attachedFile.name.toLowerCase().endsWith(".csv")
          ? "csv"
          : attachedFile.name.toLowerCase().endsWith(".tsv")
            ? "tsv"
            : attachedFile.name.toLowerCase().endsWith(".xlsx")
              ? "excel_base64"
              : undefined
        : undefined;

      // Log what we're sending
      console.log('[handleSubmit] Sending query with:', {
        attachedFile: attachedFile?.name,
        fileType,
        hasFileContent: !!fileContent,
        fileContentLength: fileContent?.length,
        fileContentPreview: fileContent?.substring(0, 100),
        hasImageBase64: !!imageBase64,
      });

      // Determine library filtering based on knowledge selection
      let library_ids: number[] | null = null;
      if (selectedKnowledgeId && !selectedLibraryId && knowledgeLibrariesMap[String(selectedKnowledgeId)]) {
        // Knowledge is selected but "All Libraries" is chosen
        // Collect all library IDs from the knowledge's libraries
        library_ids = knowledgeLibrariesMap[String(selectedKnowledgeId)].libraries.map(lib => lib.id);
        console.log(`[App] Knowledge ${selectedKnowledgeId} selected with "All Libraries". Sending library_ids:`, library_ids);
      }

      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: userMessage.content,
          thread_id: threadId,
          stream: true,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          knowledge_id: selectedKnowledgeId,
          library_id: selectedLibraryId,
          library_ids: library_ids,
          model_id: selectedModelId,
          search_strategy:
            localStorage.getItem("smartlib_mmr_enabled") !== "false" ? "mmr" : "similarity",
          // File attachments
          image_base64: imageBase64,
          image_mime_type: imageMimeType,
          uploaded_file_content: fileContent,
          uploaded_file_type: fileType,
          uploaded_file_name: attachedFile?.name,
        }),
      });

      if (!response.ok) {
        // Try to get error message from response body
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If JSON parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      // Clear attachments after sending
      setAttachedFile(null);
      setFileContent(null);
      setImageBase64(null);
      setImageMimeType(null);

      // Note: Don't clear activeContent here - let new data replace it naturally

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let citations: Citation[] = [];

      if (reader) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          citations: [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Buffer for incomplete SSE lines
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (ending with \n)
          const lines = buffer.split("\n");

          // Keep the last incomplete line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              console.log('[SSE RAW]', line.slice(0, 150));
              try {
                const data = JSON.parse(line.slice(6));

                // Handle agent_progress events
                if (data.type === "agent_progress" && data.status) {
                  console.log('[SSE] agent_progress:', data.status);
                  setAgentStatus(data.status);
                }
                // Handle metadata_update from /api/query (contains answer, citations, etc)
                else if (data.type === "metadata_update" && data.metadata) {
                  const meta = data.metadata;
                  if (meta.answer) {
                    assistantContent = meta.answer;
                  }
                  if (meta.citations) {
                    citations = meta.citations;
                  }
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                          ...m,
                          content: assistantContent || m.content,
                          citations: citations.length > 0 ? citations : m.citations,
                          suggestedQuestions: meta.suggested_questions || m.suggestedQuestions,
                          usageMetadata: meta.usage_metadata || m.usageMetadata,
                          mapData: (meta.html_map_url || meta.map_image_base64) ? {
                            htmlUrl: meta.html_map_url,
                            imageBase64: meta.map_image_base64,
                            imageMimeType: meta.map_image_mime_type || 'image/png'
                          } : m.mapData,
                        }
                        : m,
                    ),
                  );

                  // Check for data sample in metadata (priority over charts)
                  if (meta.data_sample) {
                    console.log('Received data sample from backend');
                    // Store in activeContent for Live Preview sidebar
                    setActiveContent({
                      type: 'data_sample',
                      columns: meta.data_sample.columns,
                      data: meta.data_sample.data,
                      totalRows: meta.data_sample.total_rows,
                      filename: meta.data_sample.filename
                    });
                    // Use ref to track attached tables (sync updates to avoid race conditions)
                    if (!attachedTableFilenames.current.has(meta.data_sample.filename)) {
                      attachedTableFilenames.current.add(meta.data_sample.filename);
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMessage.id
                            ? { ...m, tableData: { columns: meta.data_sample.columns, data: meta.data_sample.data, totalRows: meta.data_sample.total_rows, filename: meta.data_sample.filename } }
                            : m,
                        ),
                      );
                    }
                    // Note: Don't auto-switch views - let users stay in their preferred view
                    // Data sample will display inline in classic mode or in sidebar
                  }
                  // Check for generated chart in metadata
                  else if (meta.chart_image_base64) {
                    console.log('Received chart image from backend');
                    // Store in activeContent for Live Preview sidebar
                    setActiveContent({
                      type: 'chart',
                      base64: meta.chart_image_base64,
                      mimeType: meta.chart_image_mime_type || 'image/png'
                    });
                    // Use ref to track attached charts (sync updates to avoid race conditions)
                    if (!attachedChartBase64s.current.has(meta.chart_image_base64.slice(0, 100))) {
                      attachedChartBase64s.current.add(meta.chart_image_base64.slice(0, 100));
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMessage.id
                            ? { ...m, chartData: { base64: meta.chart_image_base64, mimeType: meta.chart_image_mime_type || 'image/png' } }
                            : m,
                        ),
                      );
                    }
                    // Note: Chart will display inline in Classic view or in Live Preview in Sidebar view
                    // Note: Chart will display inline in Classic view or in Live Preview in Sidebar view
                  }

                  // Check for HIL (Human-in-the-Loop) confirmation required
                  if (meta.confirmation_required && meta.hil_options) {
                    console.log('[HIL] Confirmation required detected:', meta.hil_options);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                            ...m,
                            hilOptions: meta.hil_options,
                            confirmationRequired: true,
                            confirmationType: meta.confirmation_type,
                          }
                          : m
                      )
                    );
                  }
                }
                // Handle end_of_stream from /api/query
                else if (data.type === "end_of_stream" && data.data) {
                  const endData = data.data;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                          ...m,
                          content: endData.answer || m.content,
                          citations: endData.citations || m.citations,
                          suggestedQuestions: endData.suggested_questions || m.suggestedQuestions,
                          usageMetadata: endData.usage_metadata || m.usageMetadata,
                          mapData: (endData.html_map_url || endData.map_image_base64) ? {
                            htmlUrl: endData.html_map_url,
                            imageBase64: endData.map_image_base64,
                            imageMimeType: endData.map_image_mime_type || 'image/png'
                          } : m.mapData,
                        }
                        : m,
                    ),
                  );
                  setAgentStatus(null); // Clear progress status when stream completes
                }
                // Handle text_chunk for true streaming (if backend sends it)
                else if (data.type === "text_chunk" && data.content) {
                  assistantContent += data.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m,
                    ),
                  );
                }
                // Handle errors
                else if (data.type === "error") {
                  setError(data.message || "Unknown error");
                }
              } catch (e) {
                // Skip non-JSON lines or heartbeats
                console.debug("Skipped SSE line:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setAgentStatus(null);
    } finally {
      setIsLoading(false);
      setAgentStatus(null);
    }
  };

  // Handler for sidebar submissions (uses shared messages state)
  const handleSidebarSubmit = useCallback(async (
    userInput: string,
    directFileContent?: string | null,
    directFileType?: 'csv' | 'tsv' | 'excel_base64' | null
  ) => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userInput.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Determine library filtering based on knowledge selection
      let library_ids: number[] | null = null;
      if (selectedKnowledgeId && !selectedLibraryId && knowledgeLibrariesMap[String(selectedKnowledgeId)]) {
        // Knowledge is selected but "All Libraries" is chosen
        // Collect all library IDs from the knowledge's libraries
        library_ids = knowledgeLibrariesMap[String(selectedKnowledgeId)].libraries.map(lib => lib.id);
        console.log(`[Sidebar] Knowledge ${selectedKnowledgeId} selected with "All Libraries". Sending library_ids:`, library_ids);
      }

      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: userMessage.content,
          thread_id: threadId,
          stream: true,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          knowledge_id: selectedKnowledgeId,
          library_id: selectedLibraryId,
          library_ids: library_ids,
          search_strategy:
            localStorage.getItem("smartlib_mmr_enabled") !== "false" ? "mmr" : "similarity",
          // Include image data for vision analysis
          image_base64: imageBase64,
          image_mime_type: imageMimeType,
          // Include file attachment data - use direct params if provided, otherwise use state
          uploaded_file_content: directFileContent !== undefined ? directFileContent : fileContent,
          uploaded_file_type: directFileType !== undefined ? directFileType : (
            attachedFile ? (
              attachedFile.name.toLowerCase().endsWith('.csv') ? 'csv' :
                attachedFile.name.toLowerCase().endsWith('.tsv') ? 'tsv' :
                  attachedFile.name.toLowerCase().endsWith('.xlsx') ? 'excel_base64' :
                    null
            ) : null
          ),
          uploaded_file_name: attachedFile?.name,
          // Phase 2B: Excel sheet selection
          excel_sheet_names: attachedFile?.name.toLowerCase().endsWith('.xlsx') && selectedExcelSheets.length > 0
            ? selectedExcelSheets
            : undefined,
        }),
      });

      if (!response.ok) {
        // Try to get error message from response body
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If JSON parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let citations: Citation[] = [];

      if (reader) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          citations: [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "metadata_update" && data.metadata) {
                  const meta = data.metadata;
                  if (meta.answer) {
                    assistantContent = meta.answer;
                  }
                  if (meta.citations) {
                    citations = meta.citations;
                  }

                  // Update Live Display with data sample if present (priority over charts/maps)
                  if (meta.data_sample) {
                    console.log('[Sidebar] Data sample detected in metadata');
                    // Store in activeContent for Live Preview sidebar
                    setActiveContent({
                      type: 'data_sample',
                      columns: meta.data_sample.columns,
                      data: meta.data_sample.data,
                      totalRows: meta.data_sample.total_rows,
                      filename: meta.data_sample.filename
                    });
                    // ALSO attach to the message for persistence (only if message doesn't already have it)
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id && !m.tableData
                          ? {
                            ...m,
                            tableData: {
                              columns: meta.data_sample.columns,
                              data: meta.data_sample.data,
                              totalRows: meta.data_sample.total_rows,
                              filename: meta.data_sample.filename
                            }
                          }
                          : m,
                      ),
                    );
                  }
                  // Update Live Display with chart data if present
                  else if (meta.chart_image_base64) {
                    console.log('[Sidebar] Chart detected in metadata');
                    // Store in activeContent for Live Preview sidebar
                    setActiveContent({
                      type: 'chart',
                      base64: meta.chart_image_base64,
                      mimeType: meta.chart_image_mime_type || 'image/png'
                    });
                    // ALSO attach to the message for persistence (only if message doesn't already have it)
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id && !m.chartData
                          ? {
                            ...m,
                            chartData: {
                              base64: meta.chart_image_base64,
                              mimeType: meta.chart_image_mime_type || 'image/png'
                            }
                          }
                          : m,
                      ),
                    );
                  }
                  // Update Live Display with map data if present
                  else if (meta.html_map_url || meta.map_image_base64) {
                    console.log('[Sidebar] Map detected in metadata:', {
                      htmlUrl: meta.html_map_url,
                      hasImageData: !!meta.map_image_base64
                    });
                    setActiveContent({
                      type: 'map',
                      htmlUrl: meta.html_map_url,
                      imageUrl: meta.map_image_base64
                        ? `data:${meta.map_image_mime_type || 'image/png'};base64,${meta.map_image_base64}`
                        : undefined
                    });
                  }
                  // Auto-display first citation with visual evidence
                  // BUT: Don't overwrite if we're showing an attached image (no doclingJsonPath)
                  else if (meta.citations && meta.citations.length > 0) {
                    const isShowingAttachedImage = activeContent?.type === 'image' &&
                      !activeContent.data.doclingJsonPath;

                    if (!isShowingAttachedImage) {
                      const firstCitationWithEvidence = meta.citations.find(
                        (c: Citation) => c.has_visual_evidence || c.docling_json_path || c.doclingJsonPath
                      );
                      if (firstCitationWithEvidence) {
                        const doclingPath = firstCitationWithEvidence.docling_json_path || firstCitationWithEvidence.doclingJsonPath;
                        const bbox = firstCitationWithEvidence.raw_bbox || firstCitationWithEvidence.bbox;
                        if (doclingPath && bbox) {
                          console.log('[Sidebar] Visual evidence detected in first citation');
                          setActiveContent({
                            type: 'image',
                            data: {
                              doclingJsonPath: doclingPath,
                              pageNo: firstCitationWithEvidence.page || firstCitationWithEvidence.pageNo || 0,
                              bbox: typeof bbox === 'string' ? bbox : JSON.stringify(bbox),
                              documentId: firstCitationWithEvidence.document_id || firstCitationWithEvidence.documentId || "",
                              source: firstCitationWithEvidence.source
                            }
                          });
                        }
                      }
                    } else {
                      console.log('[Sidebar] Preserving attached image in Live Display');
                    }
                  }

                  // Debug logging for suggested questions
                  console.log('[Sidebar] metadata_update - suggested_questions:', {
                    has_suggested_questions: !!meta.suggested_questions,
                    count: meta.suggested_questions?.length || 0,
                    questions: meta.suggested_questions || 'none'
                  });

                  if (meta.suggested_questions) {
                    console.log('[Sidebar Response] Suggested questions received:', meta.suggested_questions);
                  }

                  // Check for map data
                  if (meta.html_map_url || meta.map_image_base64) {
                    console.log('[DEBUG] Map data detected in metadata_update:', {
                      html_map_url: meta.html_map_url,
                      map_image_base64: meta.map_image_base64 ? 'YES' : 'NO'
                    });
                  }

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                          ...m,
                          content: assistantContent || m.content,
                          citations: citations.length > 0 ? citations : m.citations,
                          suggestedQuestions: meta.suggested_questions || m.suggestedQuestions,
                          usageMetadata: meta.usage_metadata || m.usageMetadata,
                          mapData: (meta.html_map_url || meta.map_image_base64) ? {
                            htmlUrl: meta.html_map_url,
                            imageBase64: meta.map_image_base64,
                            imageMimeType: meta.map_image_mime_type || 'image/png'
                          } : m.mapData,
                        }
                        : m,
                    ),
                  );
                } else if (data.type === "agent_progress" && data.status) {
                  console.log('[SSE] agent_progress:', data.status);
                  setAgentStatus(data.status);
                } else if (data.type === "end_of_stream" && data.data) {
                  const endData = data.data;

                  // Debug: Check for map data in end_of_stream
                  console.log('[DEBUG] end_of_stream received, checking for map data:', {
                    has_html_map_url: !!endData.html_map_url,
                    has_map_image_base64: !!endData.map_image_base64,
                    html_map_url: endData.html_map_url,
                    all_keys: Object.keys(endData)
                  });

                  // Update Live Display with data sample if present (priority over charts/maps)
                  if (endData.data_sample) {
                    console.log('[Sidebar] Data sample detected in end_of_stream');
                    setActiveContent({
                      type: 'data_sample',
                      columns: endData.data_sample.columns,
                      data: endData.data_sample.data,
                      totalRows: endData.data_sample.total_rows,
                      filename: endData.data_sample.filename
                    });
                  }
                  // Update Live Display with chart data if present
                  else if (endData.chart_image_base64) {
                    console.log('[Sidebar] Chart detected in end_of_stream');
                    setActiveContent({
                      type: 'chart',
                      base64: endData.chart_image_base64,
                      mimeType: endData.chart_image_mime_type || 'image/png'
                    });
                  }
                  // Update Live Display with map data if present
                  else if (endData.html_map_url || endData.map_image_base64) {
                    console.log('[Sidebar] Map detected in end_of_stream:', {
                      htmlUrl: endData.html_map_url,
                      hasImageData: !!endData.map_image_base64
                    });
                    setActiveContent({
                      type: 'map',
                      htmlUrl: endData.html_map_url,
                      imageUrl: endData.map_image_base64
                        ? `data:${endData.map_image_mime_type || 'image/png'};base64,${endData.map_image_base64}`
                        : undefined
                    });
                  }
                  // Auto-display first citation with visual evidence
                  // BUT: Don't overwrite if we're showing an attached image (no doclingJsonPath)
                  else if (endData.citations && endData.citations.length > 0) {
                    const isShowingAttachedImage = activeContent?.type === 'image' &&
                      !activeContent.data.doclingJsonPath;

                    if (!isShowingAttachedImage) {
                      const firstCitationWithEvidence = endData.citations.find(
                        (c: Citation) => c.has_visual_evidence || c.docling_json_path || c.doclingJsonPath
                      );
                      if (firstCitationWithEvidence) {
                        const doclingPath = firstCitationWithEvidence.docling_json_path || firstCitationWithEvidence.doclingJsonPath;
                        const bbox = firstCitationWithEvidence.raw_bbox || firstCitationWithEvidence.bbox;
                        if (doclingPath && bbox) {
                          console.log('[Sidebar] Visual evidence detected in first citation (end_of_stream)');
                          setActiveContent({
                            type: 'image',
                            data: {
                              doclingJsonPath: doclingPath,
                              pageNo: firstCitationWithEvidence.page || firstCitationWithEvidence.pageNo || 0,
                              bbox: typeof bbox === 'string' ? bbox : JSON.stringify(bbox),
                              documentId: firstCitationWithEvidence.document_id || firstCitationWithEvidence.documentId || "",
                              source: firstCitationWithEvidence.source
                            }
                          });
                        }
                      }
                    } else {
                      console.log('[Sidebar] Preserving attached image in Live Display');
                    }
                  }

                  // Debug logging for suggested questions in end_of_stream
                  console.log('[Sidebar] end_of_stream - suggested_questions:', {
                    has_suggested_questions: !!endData.suggested_questions,
                    count: endData.suggested_questions?.length || 0,
                    questions: endData.suggested_questions || 'none'
                  });

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? {
                          ...m,
                          content: endData.answer || m.content,
                          citations: endData.citations || m.citations,
                          suggestedQuestions: endData.suggested_questions || m.suggestedQuestions,
                          usageMetadata: endData.usage_metadata || m.usageMetadata,
                          mapData: (endData.html_map_url || endData.map_image_base64) ? {
                            htmlUrl: endData.html_map_url,
                            imageBase64: endData.map_image_base64,
                            imageMimeType: endData.map_image_mime_type || 'image/png'
                          } : m.mapData,
                        }
                        : m,
                    ),
                  );
                  setAgentStatus(null);
                } else if (data.type === "text_chunk" && data.content) {
                  assistantContent += data.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantContent }
                        : m,
                    ),
                  );
                } else if (data.type === "error") {
                  setError(data.message || "Unknown error");
                  setAgentStatus(null);
                }
              } catch (e) {
                console.debug("Skipped SSE line:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setAgentStatus(null);
    } finally {
      setIsLoading(false);
      setAgentStatus(null);
      // Clear file attachments after sending
      // NOTE: Keep imageBase64/imageMimeType for Live Display persistence
      setAttachedFile(null);
      setFileContent(null);
    }
  }, [isLoading, threadId, messages, selectedKnowledgeId, selectedLibraryId, imageBase64, imageMimeType, fileContent, attachedFile]);

  const handleSelectThread = useCallback(async (id: string) => {
    setThreadId(id);
    setMessages([]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/threads/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const loadedMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            citations: msg.citations || [],
            usageMetadata: msg.usageMetadata,
            suggestedQuestions: msg.suggestedQuestions || [],
          }));
          setMessages(loadedMessages);
        }
      } else {
        console.error('Failed to fetch thread messages:', response.status);
      }
    } catch (err) {
      console.error('Error fetching thread:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNewThread = useCallback(async () => {
    const newId = `thread-${Date.now()}`;
    setThreadId(newId);
    setMessages([]);
    setInput("");
    setError(null);
    setAttachedFile(null);
    setFileContent(null);
    setImageBase64(null);
    setImageMimeType(null);
    setActiveContent(null); // Clear data samples/charts from previous conversation
    setSuggestedQuestions([]);

    // Check if self-retriever is enabled in settings
    const selfRetrieverEnabled =
      localStorage.getItem("smartlib_self_retriever") !== "false";

    if (selfRetrieverEnabled) {
      setLoadingSuggestions(true);
      try {
        // Get CSRF token first
        const csrfRes = await fetch("/api/csrf-token", {
          credentials: "include",
        });
        const csrfData = csrfRes.ok ? await csrfRes.json() : { csrf_token: "" };

        const res = await fetch("/api/self-retriever-questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfData.csrf_token,
          },
          credentials: "include",
          body: JSON.stringify({
            library_id: selectedLibraryId,
            knowledge_id: selectedKnowledgeId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestedQuestions(data.questions || []);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setLoadingSuggestions(false);
      }
    }

    // Show notification
    setNotification("New conversation started");
    setTimeout(() => setNotification(null), 2000);
  }, [selectedKnowledgeId, selectedLibraryId]);

  const handleShowEvidence = useCallback(
    (evidence: import("./components/VisualEvidence").VisualEvidenceData) => {
      if (viewMode === "sidebar") {
        // Sidebar mode: Show in Live Display Panel
        setActiveContent({ type: 'image', data: evidence });
      } else {
        // Classic mode: Show in Modal
        setSelectedEvidence(evidence);
      }
    },
    [viewMode]
  );

  // Open document viewer for a citation
  const handleOpenDocument = useCallback((
    libraryId: number,
    documentId: string,
    page?: number,
    sourceName?: string
  ) => {
    setViewerDoc({ libraryId, documentId, page, sourceName });
    setViewerOpen(true);
  }, []);



  const handleFileSelect = useCallback(
    (file: File | null, content?: string) => {
      if (!file) {
        setAttachedFile(null);
        setFileContent(null);
        return;
      }

      setAttachedFile(file);

      // Clear image if file is selected
      if (!file.type.startsWith("image/")) {
        setImageBase64(null);
        setImageMimeType(null);
      }

      // Clear previous data sample/charts when new file is attached
      if (activeContent) {
        console.log('[File Upload] Clearing previous activeContent:', activeContent.type);
        setActiveContent(null);
      }

      // Read file content for CSV/TSV/Excel files
      const fileName = file.name.toLowerCase();
      const reader = new FileReader();

      if (fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
        // Read CSV/TSV as text
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFileContent(content);
          console.log(`CSV/TSV file loaded: ${file.name}, ${content.length} characters`);
        };
        reader.onerror = () => {
          console.error('Error reading CSV/TSV file');
          setNotification('Error reading file');
          setTimeout(() => setNotification(null), 2000);
        };
        reader.readAsText(file);
      } else if (fileName.endsWith('.xls')) {
        // Reject old .xls format
        setAttachedFile(null);
        setFileContent(null);
        setNotification('Old Excel format (.xls) not supported. Please convert to .xlsx or save as CSV');
        setTimeout(() => setNotification(null), 4000);
        console.warn('Rejected .xls file - only .xlsx format is supported');
      } else if (fileName.endsWith('.xlsx')) {
        // Read modern Excel as base64
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64Content = result.split(',')[1]; // Extract base64 part
          setFileContent(base64Content);
          console.log(`Excel file loaded: ${file.name}, ${base64Content.length} characters (base64)`);
        };
        reader.onerror = () => {
          console.error('Error reading Excel file');
          setNotification('Error reading file');
          setTimeout(() => setNotification(null), 2000);
        };
        reader.readAsDataURL(file);
      } else if (content) {
        // Use provided content (for backward compatibility)
        setFileContent(content);
      } else {
        // Unsupported file type
        setFileContent(null);
      }
    },
    [setNotification],
  );

  const handleImageSelect = useCallback((base64: string, mimeType: string) => {
    setImageBase64(base64);
    setImageMimeType(mimeType);
  }, []);

  // Handle document upload (for ingestion to vector store)
  const handleUploadFile = useCallback(async (file: File) => {
    setUploadStatuses((prev) => [
      ...prev,
      {
        fileName: file.name,
        progress: 0,
        status: "uploading",
      },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadStatuses((prev) =>
        prev.map((s) =>
          s.fileName === file.name
            ? { ...s, status: "processing", progress: 100 }
            : s,
        ),
      );

      // Poll for processing status or just mark done after a bit
      setTimeout(() => {
        setUploadStatuses((prev) =>
          prev.map((s) =>
            s.fileName === file.name ? { ...s, status: "done" } : s,
          ),
        );
        // Remove after 3 seconds
        setTimeout(() => {
          setUploadStatuses((prev) =>
            prev.filter((s) => s.fileName !== file.name),
          );
        }, 3000);
      }, 2000);
    } catch (err) {
      setUploadStatuses((prev) =>
        prev.map((s) =>
          s.fileName === file.name
            ? {
              ...s,
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            }
            : s,
        ),
      );
    }
  }, []);

  // Handle capture screen
  const handleCaptureScreen = useCallback(async () => {
    try {
      // Use browser's screen capture API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0);

      track.stop(); // Stop sharing

      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
      setImageMimeType("image/png");

      // Auto-send in Sidebar view
      if (viewMode === "sidebar") {
        // Show in Live Display
        setActiveContent({
          type: 'image',
          data: {
            doclingJsonPath: '',
            pageNo: 0,
            bbox: '',
            documentId: '',
            source: 'Screen Capture'
          }
        });

        // Auto-send with default message
        setTimeout(() => {
          handleSidebarSubmit("Analyze this screenshot");
        }, 100);
      } else {
        setNotification("Screen captured! Ask a question about it.");
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      console.error("Screen capture error:", err);
      setError("Screen capture was cancelled or not supported");
    }
  }, [viewMode, handleSidebarSubmit, setActiveContent]);

  // Wrapper for file select with auto-send in Sidebar view
  const handleFileSelectWithAutoSend = useCallback(
    (file: File) => {
      handleFileSelect(file);

      if (viewMode === "sidebar") {
        const fileName = file.name.toLowerCase();
        let defaultMessage = "Analyze this file";

        if (file.type.startsWith("image/")) {
          defaultMessage = "Describe this image";
          // For images, read and show in Live Display
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            setImageBase64(base64);
            setImageMimeType(file.type);

            // Show image in Live Display panel
            setActiveContent({
              type: 'image',
              data: {
                doclingJsonPath: '',
                pageNo: 0,
                bbox: '',
                documentId: '',
                source: file.name
              }
            });

            // Auto-send with image data directly (don't rely on state)
            setTimeout(async () => {
              if (isLoading) return;

              const userMessage: Message = {
                id: Date.now().toString(),
                role: "user",
                content: defaultMessage,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, userMessage]);
              setIsLoading(true);

              try {
                const response = await fetch("/api/query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    query: defaultMessage,
                    thread_id: threadId,
                    stream: true,
                    history: messages.map((m) => ({ role: m.role, content: m.content })),
                    knowledge_id: selectedKnowledgeId,
                    library_id: selectedLibraryId,
                    search_strategy: localStorage.getItem("smartlib_mmr_enabled") !== "false" ? "mmr" : "similarity",
                    // Use image data from closure, not state
                    image_base64: base64,
                    image_mime_type: file.type,
                    uploaded_file_content: null,
                    uploaded_file_type: null,
                    uploaded_file_name: null,
                  }),
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Handle streaming response (simplified - just get the answer)
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let assistantContent = "";

                if (reader) {
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "",
                    citations: [],
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, assistantMessage]);

                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                      if (line.startsWith("data: ")) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          console.log('[Image Auto-Send] SSE event:', data.type, data);

                          if (data.type === "text_chunk" && data.content) {
                            assistantContent += data.content;
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === assistantMessage.id
                                  ? { ...m, content: assistantContent }
                                  : m
                              )
                            );
                          } else if (data.type === "metadata_update" && data.metadata) {
                            const meta = data.metadata;
                            console.log('[Image Auto-Send] metadata_update:', {
                              suggested_questions: meta.suggested_questions,
                              citations: meta.citations?.length
                            });
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === assistantMessage.id
                                  ? {
                                    ...m,
                                    citations: meta.citations || m.citations,
                                    suggestedQuestions: meta.suggested_questions || m.suggestedQuestions,
                                    usageMetadata: meta.usage_metadata || m.usageMetadata,
                                  }
                                  : m
                              )
                            );
                          } else if (data.type === "end_of_stream" && data.data) {
                            console.log('[Image Auto-Send] end_of_stream:', {
                              suggested_questions: data.data.suggested_questions,
                              citations: data.data.citations?.length
                            });
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === assistantMessage.id
                                  ? {
                                    ...m,
                                    content: data.data.answer || m.content,
                                    citations: data.data.citations || m.citations,
                                    suggestedQuestions: data.data.suggested_questions || m.suggestedQuestions,
                                  }
                                  : m
                              )
                            );
                          }
                        } catch (e) {
                          console.debug("Skipped SSE line:", line);
                        }
                      }
                    }
                  }
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to send message");
              } finally {
                setIsLoading(false);
                setAttachedFile(null);
                setFileContent(null);
              }
            }, 100);
          };
          reader.readAsDataURL(file);
        } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
          defaultMessage = "Analyze this CSV data";
          // Read CSV/TSV file and auto-send with content
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            setFileContent(content);
            console.log(`[Auto-send] CSV/TSV loaded: ${file.name}, ${content.length} characters`);
            setTimeout(() => {
              if (!isLoading) handleSidebarSubmit(defaultMessage, content, fileName.endsWith('.csv') ? 'csv' : 'tsv');
            }, 100);
          };
          reader.readAsText(file);
        } else if (fileName.endsWith('.xlsx')) {
          // DON'T auto-send Excel - wait for user to select sheets and click "Analyze"
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64Content = result.split(',')[1];
            setFileContent(base64Content);
            console.log(`[Auto-send] Excel file loaded: ${file.name}, ${base64Content.length} characters (base64) - waiting for sheet selection`);
            // File content is already set by handleFileSelect
            // User must click "Analyze File" button to send
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [handleFileSelect, viewMode, handleSidebarSubmit, setActiveContent]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Notification Toast */}
        {notification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
            {notification}
          </div>
        )}

        {/* History Panel */}
        <HistoryPanel
          currentThreadId={threadId}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
        />

        {/* Sidebar Mode: Inline Two-Panel Layout */}
        {viewMode === "sidebar" && (
          <>
            {/* Header Navbar - Consistent with Classic View */}
            <header className="chat-header">
              <div className="flex items-center gap-2">
                {branding.logo_url && (
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-contain"
                  />
                )}
                <h1>{branding.app_name || "SmartLib"} Chat</h1>
                <Badge variant="secondary">v2.0</Badge>
              </div>

              {/* User Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <MessagesSquare className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {userStats.messageCount}
                  </span>
                  <span className="text-muted-foreground">Messages</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {userStats.docsCount}
                  </span>
                  <span className="text-muted-foreground">Documents</span>
                </div>
              </div>

              <div className="header-actions">
                <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
                <KnowledgeSelector
                  selectedKnowledgeId={selectedKnowledgeId}
                  selectedLibraryId={selectedLibraryId}
                  onKnowledgeChange={setSelectedKnowledgeId}
                  onLibraryChange={setSelectedLibraryId}
                />
                <UploadStatusBadge />
                <ThemeToggle />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
                <NavigationMenu
                  username={username}
                  isAdmin={isAdmin}
                  profilePictureUrl={profilePictureUrl}
                  onNewConversation={handleNewThread}
                />
              </div>
            </header>

            {/* Two-Panel Layout: Live Display + Sidebar */}
            <div className="flex-1 flex h-full overflow-hidden min-w-0">
              {/* Live Display Panel (Left/Center) */}
              <div className="flex min-w-0 overflow-hidden" style={{ width: 'calc(100% - 400px)', maxWidth: 'calc(100% - 400px)' }}>
                <LiveDisplay
                  activeContent={activeContent}
                  imageBase64={imageBase64}
                  imageMimeType={imageMimeType}
                />
              </div>

              {/* Chat Sidebar (Right) */}
              <div className="w-[400px] border-l flex flex-col bg-background relative z-10">
                <CustomSidebar
                  messages={messages}
                  onSubmit={handleSidebarSubmit}
                  onSendMessage={handleSidebarSubmit}
                  threadId={threadId}
                  isLoading={isLoading}
                  onToggle={() => setViewMode("classic")}
                  onContentUpdate={setActiveContent}
                  onOpenDocument={handleOpenDocument}
                  selectedKnowledgeId={selectedKnowledgeId}
                  selectedLibraryId={selectedLibraryId}
                  viewMode={viewMode}
                  onUploadFile={handleUploadFile}
                  onAttachFile={handleFileSelectWithAutoSend}
                  onCaptureScreen={handleCaptureScreen}
                  onNewConversation={handleNewThread}
                  imageBase64={imageBase64}
                  imageMimeType={imageMimeType}
                  onClearImage={() => {
                    setImageBase64(null);
                    setImageMimeType(null);
                  }}
                  attachedFile={attachedFile}
                  onClearFile={() => {
                    setAttachedFile(null);
                    setFileContent(null);
                    setSelectedExcelSheets([]);
                  }}
                  selectedExcelSheets={selectedExcelSheets}
                  onExcelSheetsChange={setSelectedExcelSheets}
                  fileError={fileError}
                />
              </div>
            </div>
          </>
        )}

        {/* Classic Mode: Center Chat */}
        {viewMode === "classic" && (
          <div className="app-container">
            <header className="chat-header">
              <div className="flex items-center gap-2">
                {branding.logo_url && (
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-contain"
                  />
                )}
                <h1>{branding.app_name || "SmartLib"} Chat</h1>
                <Badge variant="secondary">v2.0</Badge>
              </div>

              {/* User Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <MessagesSquare className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {userStats.messageCount}
                  </span>
                  <span className="text-muted-foreground">Messages</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {userStats.docsCount}
                  </span>
                  <span className="text-muted-foreground">Documents</span>
                </div>
              </div>

              <div className="header-actions">
                <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} />
                <KnowledgeSelector
                  selectedKnowledgeId={selectedKnowledgeId}
                  selectedLibraryId={selectedLibraryId}
                  onKnowledgeChange={setSelectedKnowledgeId}
                  onLibraryChange={setSelectedLibraryId}
                />
                <UploadStatusBadge />
                <ThemeToggle />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
                <NavigationMenu
                  username={username}
                  isAdmin={isAdmin}
                  profilePictureUrl={profilePictureUrl}
                  onNewConversation={handleNewThread}
                />
              </div>
            </header>

            {/* Upload Status Bar */}
            {uploadStatuses.length > 0 && (
              <div className="upload-status-bar">
                {uploadStatuses.map((status, idx) => (
                  <div
                    key={idx}
                    className={`upload-status upload-${status.status}`}
                  >
                    <span className="upload-name">{status.fileName}</span>
                    {status.status === "uploading" && (
                      <progress value={status.progress} max={100} />
                    )}
                    {status.status === "processing" && (
                      <Clock className="h-4 w-4 animate-spin" />
                    )}
                    {status.status === "done" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {status.status === "error" && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> {status.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Classic Mode: Center Chat */}

            {/* Main Chat Area - Native scrolling for edge scrollbar */}
            <div className="chat-main flex-1 overflow-y-auto">
              <div className="message-list max-w-4xl mx-auto p-4 md:p-6 pb-20">
                {messages.length === 0 ? (
                  <div className="empty-state flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                    <div className="bg-muted/30 p-4 rounded-full mb-6">
                      <MessageCircle className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{branding.app_name || "SmartLib"}</h2>
                    <p className="text-muted-foreground max-w-md mb-8">
                      Ask questions about your documents or start a conversation.
                    </p>

                    {/* Self-retriever suggested questions */}
                    <div className="w-full max-w-lg">
                      <SuggestedQuestions
                        questions={suggestedQuestions}
                        onSelectQuestion={(q) => {
                          setInput(q);
                          setSuggestedQuestions([]);
                          // Auto-submit after short delay
                          setTimeout(() => {
                            const form = document.querySelector(
                              ".query-form",
                            ) as HTMLFormElement;
                            if (form) form.requestSubmit();
                          }, 100);
                        }}
                        isLoading={loadingSuggestions}
                      />
                    </div>

                    {imageBase64 && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50">
                        <img
                          src={`data:${imageMimeType || "image/png"};base64,${imageBase64}`}
                          alt="Captured screen"
                          className="max-h-32 mx-auto rounded-md border"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Screen captured - ask a question about it
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map((message) => {
                    // Parse markdown tables into HTML
                    const parseMarkdownTables = (content: string): { text: string; tables: Array<{ index: number; html: string }> } => {
                      const tables: Array<{ index: number; html: string }> = [];
                      let tableIndex = 0;

                      // Match markdown table blocks (including [Sheet: Name] prefix)
                      const tableRegex = /(\[Sheet:[^\]]+\]\n)?\|(.+)\|(\n\|[-:\s|]+\|)\n(\|.+\|(\n|$))+/g;

                      // Detect incomplete tables during streaming and show skeleton
                      const incompleteTableRegex = /(\[Sheet:[^\]]+\]\n)?\|(.+)\|(\n\|[-:\s|]+\|)(\n\|.+\|)?$/;
                      const hasIncompleteTable = incompleteTableRegex.test(content) && !tableRegex.test(content);

                      let textWithPlaceholders = content.replace(tableRegex, (match) => {
                        const lines = match.trim().split('\n');
                        let sheetPrefix = '';
                        let startIdx = 0;

                        // Check for [Sheet: Name] prefix
                        if (lines[0].startsWith('[Sheet:')) {
                          sheetPrefix = lines[0];
                          startIdx = 1;
                        }

                        const headers = lines[startIdx].split('|').filter(h => h.trim()).map(h => h.trim());
                        const rows = lines.slice(startIdx + 2); // Skip header and separator

                        // Unique ID for this table
                        const tableId = `table-${Date.now()}-${tableIndex}`;

                        // Clean shadcn-ui table styling (no copy button - users have message copy)
                        let tableHtml = '';

                        // Sheet name inline (if exists)
                        if (sheetPrefix) {
                          tableHtml += `<span class="text-xs text-muted-foreground">${sheetPrefix}</span>`;
                        }

                        // shadcn-ui Table styling
                        tableHtml += `<div class="w-full overflow-auto rounded-md border my-2">
                            <table id="${tableId}" class="w-full caption-bottom text-sm">
                              <thead class="[&_tr]:border-b bg-muted/50">
                                <tr class="border-b transition-colors">`;

                        headers.forEach(header => {
                          tableHtml += `<th class="h-8 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">${header}</th>`;
                        });

                        tableHtml += '</tr></thead><tbody class="[&_tr:last-child]:border-0">';

                        rows.forEach((row) => {
                          const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
                          if (cells.length > 0) {
                            tableHtml += `<tr class="border-b transition-colors hover:bg-muted/50">`;
                            cells.forEach(cell => {
                              tableHtml += `<td class="p-3 align-middle whitespace-nowrap">${cell}</td>`;
                            });
                            tableHtml += '</tr>';
                          }
                        });

                        tableHtml += '</tbody></table></div>';


                        const placeholder = `__TABLE_${tableIndex}__`;
                        tables.push({ index: tableIndex, html: tableHtml });
                        tableIndex++;
                        return placeholder;
                      });

                      // If incomplete table detected during streaming, hide the raw markdown
                      if (hasIncompleteTable && isLoading) {
                        textWithPlaceholders = textWithPlaceholders.replace(
                          incompleteTableRegex,
                          () => `<div class="my-3 animate-pulse">
                          <div class="h-4 w-24 bg-muted rounded mb-2"></div>
                          <div class="rounded-lg border bg-card shadow-sm p-4">
                            <div class="space-y-2">
                              <div class="h-6 bg-muted rounded w-full"></div>
                              <div class="h-4 bg-muted/50 rounded w-full"></div>
                              <div class="h-4 bg-muted/50 rounded w-full"></div>
                              <div class="h-4 bg-muted/50 rounded w-3/4"></div>
                            </div>
                          </div>
                        </div>`
                        );
                      }

                      return { text: textWithPlaceholders, tables };
                    };

                    // Function to render content with inline citation links
                    // Renders markdown as a single block to preserve paragraph structure,
                    // then injects citation badges via custom components
                    const renderContentWithCitations = (content: string) => {
                      if (!content) return null; // Empty content shows nothing (progress shown inline below)

                      // First, parse tables and get placeholders
                      const { text: textWithTables, tables } = parseMarkdownTables(content);

                      // Strip extra blank lines - convert ALL double newlines to single
                      // This makes the output much more compact
                      let cleanedContent = textWithTables
                        .replace(/\n{2,}/g, '\n')  // All multi-newlines become single newline
                        .replace(/^\n/, '');       // Remove leading newline if any

                      // Replace citation patterns with HTML spans that we can target
                      // Convert both [cite:X] and [X] to a consistent format for rendering
                      let processedContent = cleanedContent
                        .replace(/\[cite:(\d+)\]/g, '<cite-badge data-cite="$1"></cite-badge>')
                        .replace(/\[(\d+)\]/g, '<cite-badge data-cite="$1"></cite-badge>');

                      // Replace table placeholders with actual table HTML
                      tables.forEach(table => {
                        processedContent = processedContent.replace(
                          `__TABLE_${table.index}__`,
                          table.html
                        );
                      });

                      // Clean up stray dots/bullets that sometimes appear
                      processedContent = processedContent
                        .replace(/^[\s]*\.[\s]*$/gm, '')
                        .replace(/^\s*\.\s*\n/g, '');

                      // Custom component to render citation badges
                      const CiteBadge = ({ 'data-cite': citeNum }: { 'data-cite'?: string }) => {
                        if (!citeNum) return null;
                        const num = parseInt(citeNum, 10);
                        const citation = message.citations?.[num - 1];
                        return (
                          <Badge
                            className="mx-0.5 cursor-pointer text-[10px] font-semibold px-1.5 py-0 h-4 min-w-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors inline-flex items-center justify-center align-baseline"
                            onClick={() => {
                              const docId = citation?.documentId || citation?.document_id;
                              if (docId) {
                                const libraryId = citation?.library_id || selectedLibraryId || 1;
                                const page = citation?.page || citation?.pageNo;
                                handleOpenDocument(libraryId, docId, page, citation?.source);
                              } else {
                                const el = document.getElementById(`cite-${message.id}-${num}`);
                                el?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                          >
                            {num}
                          </Badge>
                        );
                      };

                      return (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            // Handle our custom cite-badge elements
                            'cite-badge': CiteBadge,
                            // Headings
                            h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
                            h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                            h3: ({ children }: any) => <h3 className="text-md font-bold mb-2 mt-2">{children}</h3>,
                            // Standard paragraph
                            p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                            // Lists
                            ul: ({ children }: any) => <ul className="mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }: any) => <ol className="mb-3 space-y-1">{children}</ol>,
                            li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
                            // Code blocks
                            code: ({ inline, children, ...props }: any) => {
                              if (inline) {
                                return <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
                              }
                              return (
                                <pre className="bg-muted p-3 my-3 rounded-lg overflow-x-auto border">
                                  <code className="text-sm font-mono leading-relaxed" {...props}>{children}</code>
                                </pre>
                              );
                            },
                          } as any}
                        >
                          {processedContent}
                        </ReactMarkdown>
                      );
                    };

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex w-full mb-6",
                          message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {/* No Avatars - Content only */}
                        {message.role === 'user' ? (
                          <div className="rounded-xl pl-2 pr-3 py-1.5 max-w-[65%] shadow-sm w-fit bg-zinc-900 text-white dark:bg-zinc-800">
                            {/* User attached image */}
                            {message.imageData && (
                              <img
                                src={`data:${message.imageData.mimeType};base64,${message.imageData.base64}`}
                                alt="Attached"
                                className="max-w-full h-auto rounded mb-2 max-h-48 object-contain"
                              />
                            )}
                            <span className={cn(
                              "text-sm leading-relaxed whitespace-pre-wrap",
                              (message.content.length > 80 || message.content.includes('\n')) ? "text-left block" : "text-right"
                            )}>
                              {message.content}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full max-w-none text-foreground">
                            <div className="message-text chat-prose text-sm max-w-none text-foreground">
                              {renderContentWithCitations(message.content)}
                            </div>

                            {/* Progress status - shown while streaming this message */}
                            {isLoading && message.id === messages[messages.length - 1]?.id && agentStatus && (
                              <div className="mt-3 pt-3 border-t border-border/50 opacity-70">
                                <ThinkingAnimation status={agentStatus} />
                              </div>
                            )}

                            {/* Map Display - Inline after message content */}
                            {message.role === 'assistant' && message.mapData && (() => {
                              console.log('[Classic View] Rendering map:', message.mapData);
                              return (
                                <div className="mt-4">
                                  <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                                    {/* Map iframe or image */}
                                    {message.mapData.htmlUrl ? (
                                      <iframe
                                        src={message.mapData.htmlUrl}
                                        title="Interactive Map"
                                        className="w-full border-0"
                                        style={{ height: '400px' }}
                                      />
                                    ) : message.mapData.imageBase64 ? (
                                      <div className="p-4 flex items-center justify-center bg-muted/30">
                                        <img
                                          src={`data:${message.mapData.imageMimeType};base64,${message.mapData.imageBase64}`}
                                          alt="Map"
                                          className="max-w-full h-auto rounded border shadow-sm"
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Chart Display - Inline after message content */}
                            {message.role === 'assistant' && message.chartData && (
                              <div className="mt-4">
                                <div className="bg-card border rounded-lg p-4 shadow-sm relative">
                                  {/* Copy button in top-right corner */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                        onClick={async () => {
                                          try {
                                            const img = new Image();
                                            img.src = `data:${message.chartData!.mimeType || 'image/png'};base64,${message.chartData!.base64}`;
                                            await img.decode();
                                            const canvas = document.createElement('canvas');
                                            canvas.width = img.width;
                                            canvas.height = img.height;
                                            const ctx = canvas.getContext('2d');
                                            ctx?.drawImage(img, 0, 0);
                                            canvas.toBlob(async (blob) => {
                                              if (blob) {
                                                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                                              }
                                            }, 'image/png');
                                          } catch (err) {
                                            console.error('Failed to copy chart:', err);
                                          }
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy chart image</TooltipContent>
                                  </Tooltip>
                                  <div className="flex items-center justify-center">
                                    <img
                                      src={`data:${message.chartData.mimeType || 'image/png'};base64,${message.chartData.base64}`}
                                      alt="Generated Chart"
                                      className="max-w-full h-auto rounded border shadow-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Data Table Display - Inline after message content */}
                            {message.role === 'assistant' && message.tableData && (
                              <div className="mt-4">
                                <div className="bg-card border rounded-lg p-4 shadow-sm relative">
                                  {/* Copy button in top-right corner */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                        onClick={() => {
                                          try {
                                            const headers = message.tableData!.columns.join('\t');
                                            const rows = message.tableData!.data.map(row => row.map(cell => cell !== null && cell !== undefined ? String(cell) : '').join('\t'));
                                            const csvText = [headers, ...rows].join('\n');
                                            navigator.clipboard.writeText(csvText);
                                          } catch (err) {
                                            console.error('Failed to copy table:', err);
                                          }
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy table data</TooltipContent>
                                  </Tooltip>
                                  <div className="mb-3">
                                    <h3 className="font-semibold text-base">{message.tableData.filename}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      Showing first 5 rows of {message.tableData.totalRows.toLocaleString()} total rows
                                    </p>
                                  </div>
                                  <div className="border rounded overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/50 border-b">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                                            #
                                          </th>
                                          {message.tableData.columns.map((col, idx) => (
                                            <th
                                              key={idx}
                                              className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                                            >
                                              {col}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {message.tableData.data.map((row, rowIdx) => (
                                          <tr key={rowIdx} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-3 py-2 font-medium text-muted-foreground">
                                              {rowIdx + 1}
                                            </td>
                                            {row.map((cell, cellIdx) => (
                                              <td key={cellIdx} className="px-3 py-2 whitespace-nowrap">
                                                {cell !== null && cell !== undefined ? String(cell) : <span className="text-muted-foreground italic">null</span>}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* HIL (Human-in-the-Loop) Confirmation Buttons */}
                            {message.confirmationRequired && message.hilOptions && message.hilOptions.length > 0 && (
                              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/40">
                                <span className="text-sm text-muted-foreground mr-2">Choose an option:</span>
                                {message.hilOptions.map((option, idx) => (
                                  <Button
                                    key={idx}
                                    variant={option.payload === 'yes' ? 'default' : 'outline'}
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => handleHilResponse(message.id, option.payload)}
                                    className={cn(
                                      "px-4 py-2",
                                      option.payload === 'yes' && "bg-primary hover:bg-primary/90",
                                      option.payload === 'no' && "hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                                    )}
                                  >
                                    {isLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      option.display_text
                                    )}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {/* Message Footer with Feedback */}
                            {message.role === "assistant" && message.content && (
                              <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/40">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch('/api/message_feedback', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ message_id: message.id, feedback_type: 'like' }),
                                            credentials: 'include',
                                          });
                                          if (res.ok) {
                                            (event?.target as HTMLElement)?.classList.add('text-green-500');
                                          }
                                        } catch (e) { console.error('Feedback error:', e); }
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                      </svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Helpful</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch('/api/message_feedback', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ message_id: message.id, feedback_type: 'dislike' }),
                                            credentials: 'include',
                                          });
                                          if (res.ok) {
                                            (event?.target as HTMLElement)?.classList.add('text-red-500');
                                          }
                                        } catch (e) { console.error('Feedback error:', e); }
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                      </svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Not helpful</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                      onClick={() => {
                                        navigator.clipboard.writeText(message.content);
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy response</p>
                                  </TooltipContent>
                                </Tooltip>
                                {/* Token info */}
                                {message.usageMetadata && (
                                  message.usageMetadata.input_tokens || message.usageMetadata.output_tokens
                                ) && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {message.usageMetadata.input_tokens && `${message.usageMetadata.input_tokens} in`}
                                      {message.usageMetadata.input_tokens && message.usageMetadata.output_tokens && ' / '}
                                      {message.usageMetadata.output_tokens && `${message.usageMetadata.output_tokens} out`}
                                    </span>
                                  )}
                              </div>
                            )}

                            {/* Citations List */}
                            {message.citations && message.citations.length > 0 && (
                              <div className="citations mt-4 p-3">
                                <div className="citations-header flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
                                  <BookOpen className="h-4 w-4" /> Sources
                                </div>
                                <div className="citation-list flex flex-wrap gap-2">
                                  {message.citations.map((citation, idx) => (
                                    <Tooltip key={idx}>
                                      <TooltipTrigger asChild>
                                        <div
                                          id={`cite-${message.id}-${idx + 1}`}
                                          className="citation-item inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-background border border-border/50 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                                          onClick={() => {
                                            const docId = citation.documentId || citation.document_id;
                                            if (docId) {
                                              const libraryId = citation.library_id || selectedLibraryId || 1;
                                              const page = citation.page || citation.pageNo;
                                              // Open document viewer modal
                                              handleOpenDocument(libraryId, docId, page, citation.source);
                                            }
                                          }}
                                        >
                                          <Badge
                                            variant="secondary"
                                            className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
                                          >
                                            {idx + 1}
                                          </Badge>
                                          <span className="text-muted-foreground max-w-[200px] truncate">
                                            {citation.source}{(citation.page || citation.pageNo) ? ` (p.${citation.page || citation.pageNo})` : ''}
                                          </span>
                                          {/* Show visual evidence button if raw_bbox/bbox and docling path are available */}
                                          {(citation.raw_bbox || citation.bbox) && (citation.doclingJsonPath || citation.docling_json_path || citation.has_visual_evidence) && (
                                            <VisualEvidenceButton
                                              evidence={{
                                                doclingJsonPath: citation.doclingJsonPath || citation.docling_json_path || "",
                                                pageNo: citation.page || citation.pageNo || 0,
                                                // Use raw_bbox (dict format) if available, otherwise bbox
                                                bbox: citation.raw_bbox
                                                  ? JSON.stringify(citation.raw_bbox)
                                                  : (typeof citation.bbox === 'string' ? citation.bbox : JSON.stringify(citation.bbox)),
                                                documentId: citation.documentId || citation.document_id || "",
                                                source: citation.source,
                                              }}
                                              onClick={handleShowEvidence}
                                            />
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">{citation.source}</p>
                                        {(citation.documentId || citation.document_id) && <p className="text-xs text-muted-foreground">Click to view document</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Follow-up Questions */}
                            {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                  <MessagesSquare className="h-3.5 w-3.5" />
                                  <span>Follow-up questions:</span>
                                </div>
                                {message.suggestedQuestions.map((q, idx) => (
                                  <Button
                                    key={idx}
                                    variant="outline"
                                    className="w-full justify-start text-left h-auto py-2.5 px-3 text-sm font-normal whitespace-normal hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                                    onClick={() => {
                                      setInput(q);
                                      setTimeout(() => {
                                        const form = document.querySelector(
                                          ".chat-footer form"
                                        ) as HTMLFormElement;
                                        if (form) form.requestSubmit();
                                      }, 100);
                                    }}
                                  >
                                    {q}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}



                {error && (
                  <div className="error-message flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {error}
                  </div>
                )}

                {/* Scroll target for auto-scroll */}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="chat-footer">
              <div className="max-w-4xl mx-auto px-4 md:px-6">
                {/* Image Preview */}
                {imageBase64 && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-lg">
                    <img
                      src={`data:${imageMimeType || "image/png"};base64,${imageBase64}`}
                      alt="Attached"
                      className="h-16 w-auto rounded border"
                    />
                    <span className="text-xs text-muted-foreground flex-1">
                      Image attached
                    </span>
                    {/* Quick Send Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
                        setInput("Describe this image");
                        setTimeout(() => handleSubmit(fakeEvent), 0);
                      }}
                      disabled={isLoading}
                      className="h-5 w-5 p-0 hover:bg-muted"
                      title="Send with 'Describe this image'"
                    >
                      <Wand2 className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImageBase64(null);
                        setImageMimeType(null);
                      }}
                      className="text-destructive h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                )}

                {/* Data File Preview (CSV/Excel) */}
                {attachedFile && !imageBase64 && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-lg">
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {attachedFile.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-1">
                      Ready for analysis
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAttachedFile(null);
                        setFileContent(null);
                      }}
                      className="text-destructive h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                )}

                <form
                  className="flex flex-col items-stretch gap-2 p-3 bg-background border rounded-xl shadow-sm transition-all duration-300 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 focus-within:shadow-[0_0_15px_var(--color-primary)]"
                  onSubmit={handleSubmit}
                  style={{ minHeight: 'auto' }} // Override any existing min-height
                >
                  <div className="flex items-end gap-2 w-full">
                    <ActionMenu
                      onUploadFile={handleUploadFile}
                      onAttachFile={(file) => {
                        console.log('[ActionMenu] File attached:', file.name, 'Type:', file.type);
                        if (file.type.startsWith("image/")) {
                          // Handle image
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            const result = e.target?.result as string;
                            const base64 = result.split(",")[1];
                            const mimeType =
                              result.match(/data:(.*?);/)?.[1] || "image/png";
                            setImageBase64(base64);
                            setImageMimeType(mimeType);
                            setNotification("Image attached!");
                            setTimeout(() => setNotification(null), 2000);
                          };
                          reader.readAsDataURL(file);
                        } else {
                          // Handle data file (CSV, Excel)
                          console.log('[ActionMenu] Calling handleFileSelect for data file:', file.name);
                          handleFileSelect(file);
                          setNotification(`${file.name} attached for analysis`);
                          setTimeout(() => setNotification(null), 2000);
                        }
                      }}
                      onCaptureScreen={handleCaptureScreen}
                      onNewConversation={handleNewThread}
                      disabled={isLoading}
                    />
                    <FileAttachment
                      onFileSelect={handleFileSelect}
                      onImageSelect={handleImageSelect}
                      disabled={isLoading}
                    />
                    <Textarea
                      ref={textareaRef}
                      className="query-input flex-1 min-h-[2.5rem] max-h-48 resize-none border-none bg-transparent focus-visible:ring-0 p-1"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;

                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.startsWith("image/")) {
                            const file = items[i].getAsFile();
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const result = event.target?.result as string;
                                const base64 = result.split(",")[1];
                                const mimeType =
                                  result.match(/data:(.*?);/)?.[1] || "image/png";
                                setImageBase64(base64);
                                setImageMimeType(mimeType);
                                if (!input.trim()) {
                                  setInput("Image pasted from clipboard");
                                }
                                setNotification("Image pasted!");
                                setTimeout(() => setNotification(null), 2000);
                              };
                              reader.readAsDataURL(file);
                              e.preventDefault();
                            }
                            break;
                          }
                        }
                      }}
                      placeholder="Ask about your documents..."
                      disabled={isLoading}
                      rows={1}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isLoading || !input.trim()}
                      className="mb-0.5" // Align with bottom of textarea
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Model selector hidden for now
                  <div className="flex justify-start px-1 w-full">
                    <ModelSelector
                      onModelChange={handleModelChange}
                    />
                  </div>
                  */}
                </form>
              </div>
            </footer>
          </div>
        )}

        <VisualEvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />

        <DocumentViewer
          isOpen={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setViewerDoc(null);
          }}
          libraryId={viewerDoc?.libraryId ?? null}
          documentId={viewerDoc?.documentId ?? null}
          page={viewerDoc?.page}
          sourceName={viewerDoc?.sourceName}
        />

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </div>
    </TooltipProvider >
  );
}
