import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, PanelRightClose, Send, Wand2, Loader2, Eye, BookOpen, X, MessagesSquare } from 'lucide-react';
import { ActionMenu } from './ActionMenu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/utils/cn';
import { ThinkingAnimation } from "./ThinkingAnimation";
import { ExcelSheetSelector } from './ExcelSheetSelector';
import { getFileIcon, formatFileSize } from '@/utils/fileValidation';
import { ActiveContent, Message } from "../App";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomSidebarProps {
  messages: Message[];
  onSubmit: (input: string) => Promise<void>;
  onSendMessage?: (message: string) => void;  // For follow-up questions
  threadId?: string;
  isLoading: boolean;
  onToggle: () => void;
  onContentUpdate?: (content: ActiveContent) => void;
  onOpenDocument?: (libraryId: number, documentId: string, page?: number, sourceName?: string) => void;
  selectedKnowledgeId?: number | null;
  selectedLibraryId?: number | null;
  viewMode?: 'classic' | 'sidebar';
  onUploadFile?: (file: File) => void;
  onAttachFile?: (file: File) => void;
  onCaptureScreen?: () => void;
  onNewConversation?: () => void;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  onClearImage?: () => void;
  attachedFile?: File | null;
  onClearFile?: () => void;
  // Phase 2B: Excel sheet selection
  selectedExcelSheets?: string[];
  onExcelSheetsChange?: (sheets: string[]) => void;
  fileError?: string | null;
}

export function CustomSidebar({
  messages,
  onSubmit,
  onSendMessage,
  isLoading,
  onToggle,
  onContentUpdate,
  onOpenDocument,
  selectedLibraryId,
  onUploadFile,
  onAttachFile,
  onCaptureScreen,
  onNewConversation,
  imageBase64,
  imageMimeType,
  onClearImage,
  attachedFile,
  onClearFile,
  selectedExcelSheets,
  onExcelSheetsChange,
  fileError
}: CustomSidebarProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    await onSubmit(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle visual evidence click - show in Live Preview
  const handleShowEvidence = (citation: NonNullable<Message['citations']>[number]) => {
    const doclingPath = citation.docling_json_path || citation.doclingJsonPath;
    const bbox = citation.raw_bbox || citation.bbox;

    if (onContentUpdate && doclingPath && bbox) {
      const bboxStr = typeof bbox === 'string'
        ? bbox
        : typeof bbox === 'object' && 'l' in bbox
          ? JSON.stringify(bbox)
          : Array.isArray(bbox)
            ? JSON.stringify(bbox)
            : '';

      onContentUpdate({
        type: 'image',
        data: {
          doclingJsonPath: doclingPath,
          pageNo: citation.page || citation.pageNo || 0,
          bbox: bboxStr,
          documentId: citation.documentId || citation.document_id || "",
          source: citation.source
        }
      });
    }
  };

  // Clean content - remove all standalone dots aggressively
  const cleanContent = (text: string): string => {
    return text
      // Remove lines that are just a dot with whitespace
      .replace(/^\s*\.\s*$/gm, '')
      // Remove dots between newlines
      .replace(/\n\s*\.\s*\n/g, '\n')
      // Remove leading dots on lines
      .replace(/^\s*\.\s+/gm, '')
      // Remove dots at start followed by space
      .replace(/^\.\s+/gm, '')
      // Remove trailing dots on empty lines
      .replace(/\n\s*\.\s*$/g, '')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Render content with clickable citation badges
  const renderContentWithCitations = (content: string) => {
    if (!content) return null;

    // Pre-clean the entire content
    const cleanedContent = cleanContent(content);
    if (!cleanedContent) return null;

    // Match both [cite:X] and [X] patterns
    const parts = cleanedContent.split(/(\[cite:\d+\]|\[\d+\])/g);

    return parts.map((part, i) => {
      // Check for [cite:X] format
      const citeMatch = part.match(/\[cite:(\d+)\]/);
      // Check for plain [X] format
      const plainMatch = !citeMatch ? part.match(/^\[(\d+)\]$/) : null;

      const match = citeMatch || plainMatch;
      if (match) {
        const citeNum = parseInt(match[1], 10);
        return (
          <Badge
            key={i}
            variant="secondary"
            className="mx-0.5 cursor-default text-[9px] font-semibold px-1 py-0 h-3.5 min-w-3.5 rounded-full inline-flex items-center justify-center"
          >
            {citeNum}
          </Badge>
        );
      }

      // Skip empty parts
      const trimmedPart = part?.trim();
      if (!trimmedPart) return null;

      // Skip if only dots/bullets
      if (/^[\s\.\•\-\*]+$/.test(trimmedPart)) return null;

      // Render regular text
      return (
        <ReactMarkdown
          key={i}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Render inline without wrapping paragraphs
            p: ({ children }: any) => <span className="inline">{children}</span>,
            // Sidebar headers
            h1: ({ children }: any) => <h1 className="text-sm font-bold mb-1 mt-2">{children}</h1>,
            h2: ({ children }: any) => <h2 className="text-xs font-bold mb-1 mt-1.5">{children}</h2>,
            // List refinements
            ul: ({ children }: any) => <ul className="mb-2 space-y-0.5">{children}</ul>,
            ol: ({ children }: any) => <ol className="mb-2 space-y-0.5">{children}</ol>,
            li: ({ children }: any) => <li className="leading-tight">{children}</li>,
            code({ className, children, ...props }: any) {
              return (
                <code className={cn("bg-muted/50 rounded px-1 py-0.5 text-[10px]", className)} {...props}>
                  {children}
                </code>
              )
            },
            a({ href, children, ...props }: any) {
              if (href?.startsWith('/generated-maps/')) {
                return (
                  <span className="inline-flex items-center gap-1 text-primary font-medium text-[10px]">
                    📍 Map
                  </span>
                );
              }
              return <a href={href} className="text-primary underline text-[11px]" {...props}>{children}</a>;
            }
          } as any}
        >
          {part}
        </ReactMarkdown>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">SmartLib Assistant</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground mt-12 px-4">
              <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium text-sm mb-1">How can I help?</p>
              <p className="text-xs opacity-70">Ask about documents or get research help.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "rounded-xl pl-1.5 pr-2.5 py-1.5 max-w-[90%] shadow-sm w-fit",
                msg.role === 'user'
                  ? "bg-zinc-900 text-white dark:bg-zinc-800 ml-auto"
                  : "bg-muted/50 text-foreground border"
              )}>
                {msg.role === 'assistant' ? (
                  <>
                    {/* Message content */}
                    {msg.content ? (
                      <div className="text-xs leading-relaxed break-words chat-prose sidebar-compact">
                        {renderContentWithCitations(msg.content)}
                      </div>
                    ) : isLoading && messages[messages.length - 1]?.id === msg.id ? (
                      <ThinkingAnimation />
                    ) : null}

                    {/* Sources section with visual evidence buttons */}
                    {msg.citations && msg.citations.length > 0 && msg.content && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                          <BookOpen className="h-3 w-3" />
                          <span>Sources</span>
                        </div>
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-1">
                            {msg.citations.map((citation, idx) => {
                              const hasEvidence = (citation.raw_bbox || citation.bbox) &&
                                (citation.doclingJsonPath || citation.docling_json_path || citation.has_visual_evidence);

                              return (
                                <Tooltip key={idx}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-background border border-border/50 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
                                      onClick={() => {
                                        const docId = citation.documentId || citation.document_id;
                                        if (onOpenDocument && docId) {
                                          const libId = citation.library_id || selectedLibraryId || 1;
                                          const page = citation.page || citation.pageNo;
                                          onOpenDocument(libId, docId, page, citation.source);
                                        }
                                      }}
                                    >
                                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px]">
                                        {idx + 1}
                                      </Badge>
                                      <span className="text-muted-foreground truncate max-w-[80px]">
                                        {citation.source?.split('/').pop() || 'Source'}
                                      </span>
                                      {hasEvidence && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleShowEvidence(citation);
                                          }}
                                          className="ml-0.5 p-0.5 hover:bg-primary/20 rounded transition-colors"
                                          title="Show visual evidence"
                                        >
                                          <Eye className="h-3 w-3 text-primary" />
                                        </button>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-[200px] truncate">{citation.source}</p>
                                    {(citation.page || citation.pageNo) && (
                                      <p className="text-xs text-muted-foreground">Page {citation.page || citation.pageNo}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                          ```
                        </TooltipProvider>
                      </div>
                    )}

                    {/* Suggested Follow-up Questions */}
                    {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                          <MessagesSquare className="h-3 w-3" />
                          <span>Follow-up questions:</span>
                        </div>
                        {msg.suggestedQuestions.map((q, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            className="w-full justify-start text-left h-auto py-2 px-2.5 text-[11px] font-normal whitespace-normal hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                            onClick={() => {
                              console.log('[Follow-up] Button clicked!', {
                                hasOnSendMessage: !!onSendMessage,
                                imageBase64Length: imageBase64?.length || 0,
                                imageMimeType: imageMimeType || 'none',
                                hasAttachedFile: !!attachedFile
                              });
                              if (onSendMessage) {
                                // Add context prefix if there's an active image or file
                                let contextualQuestion = q;
                                if (imageBase64 && imageMimeType) {
                                  contextualQuestion = `Regarding the image: ${q}`;
                                  console.log('[Follow-up] Sending with image context:', {
                                    original: q,
                                    contextual: contextualQuestion,
                                    hasImage: true
                                  });
                                } else if (attachedFile) {
                                  contextualQuestion = `Based on the uploaded data: ${q}`;
                                  console.log('[Follow-up] Sending with file context:', {
                                    original: q,
                                    contextual: contextualQuestion,
                                    fileName: attachedFile.name
                                  });
                                } else {
                                  console.log('[Follow-up] Sending without context:', {
                                    question: q
                                  });
                                }
                                onSendMessage(contextualQuestion);
                              }
                            }}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <span className={cn(
                    "text-xs whitespace-pre-wrap break-words",
                    (msg.content.length > 40 || msg.content.includes('\n')) ? "text-left" : "text-right"
                  )}>
                    {msg.content}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator - only show if last message doesn't exist or has content */}
          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.content) && (
            <div className="flex justify-start">
              <div className="px-3 py-2">
                <ThinkingAnimation />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-background">
        {/* Image Preview */}
        {imageBase64 && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-lg border">
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="Attached"
              className="h-12 w-auto rounded border object-contain"
            />
            <span className="text-xs text-muted-foreground flex-1 truncate">Image attached</span>
            {/* Quick Send Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 hover:bg-muted"
              onClick={() => {
                onSubmit('Describe this image');
              }}
              disabled={isLoading}
              type="button"
              title="Send with 'Describe this image'"
            >
              <Wand2 className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
            </Button>
            {onClearImage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClearImage}
                type="button"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* File Preview */}
        {attachedFile && (
          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              <span className="text-lg">{getFileIcon(attachedFile)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{attachedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(attachedFile.size)}</p>
              </div>
              {onClearFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onClearFile}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Excel Sheet Selector */}
            {attachedFile.name.toLowerCase().endsWith('.xlsx') && onExcelSheetsChange && (
              <div className="px-2">
                <ExcelSheetSelector
                  file={attachedFile}
                  onSheetsSelected={onExcelSheetsChange}
                  initialSelection={selectedExcelSheets}
                />
              </div>
            )}

            {/* Analyze Button for Excel files */}
            {attachedFile.name.toLowerCase().endsWith('.xlsx') && (
              <Button
                onClick={() => {
                  const defaultMessage = "Analyze this Excel file";
                  onSubmit(defaultMessage);
                }}
                disabled={isLoading}
                className="w-full mt-2"
                variant="default"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Analyze File
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* File Error Message */}
        {fileError && (
          <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-xs text-destructive">{fileError}</p>
          </div>
        )}

        {/* Action Toolbar - Above textarea */}
        {(onUploadFile || onAttachFile || onCaptureScreen || onNewConversation) && (
          <div className="flex items-center gap-2 mb-2">
            <ActionMenu
              onUploadFile={onUploadFile || (() => { })}
              onAttachFile={onAttachFile}
              onCaptureScreen={onCaptureScreen || (() => { })}
              onNewConversation={onNewConversation || (() => { })}
              disabled={isLoading}
            />
            <span className="text-xs text-muted-foreground">Actions</span>
          </div>
        )}

        {/* Input form - Full width textarea */}
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[40px] pr-10 resize-none bg-muted/20 focus-visible:ring-1 text-xs w-full"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="absolute right-1.5 bottom-1.5 h-7 w-7"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
