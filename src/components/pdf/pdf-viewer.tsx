"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { CommentSidebar } from "@/components/comments/comment-sidebar";
import { CommentForm } from "@/components/comments/comment-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Comment {
  id: string;
  content: string;
  highlightPosition: unknown;
  selectedText: string | null;
  pageNumber: number | null;
  authorName: string | null;
  authorEmail: string | null;
  authorAffiliation: string | null;
  createdAt: Date;
  replies: Comment[];
}

interface PdfViewerProps {
  documentId: string;
  pdfUrl: string;
  initialComments: Comment[];
}

// Proxy FDA URLs through our API to avoid CORS issues
function getProxiedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("fda.gov")) {
      return `/api/pdf?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Invalid URL, return as-is
  }
  return url;
}

export function PdfViewer({ documentId, pdfUrl, initialComments }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Get the proxied URL for FDA documents
  const proxiedPdfUrl = getProxiedUrl(pdfUrl);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Track current page based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      let closestPage = 1;
      let closestDistance = Infinity;

      pageRefs.current.forEach((pageEl, pageNum) => {
        const pageRect = pageEl.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageNum;
        }
      });

      if (closestPage !== currentPage) {
        setCurrentPage(closestPage);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [numPages, currentPage]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setIsLoading(false);
  };

  // Handle text selection - detect which page the selection is on
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());

      // Try to determine which page the selection is on
      const anchorNode = selection.anchorNode;
      if (anchorNode) {
        let element = anchorNode.parentElement;
        while (element && !element.dataset.pageNumber) {
          element = element.parentElement;
        }
        if (element?.dataset.pageNumber) {
          setCurrentPage(parseInt(element.dataset.pageNumber));
        }
      }

      setShowCommentForm(true);
    }
  }, []);

  // Handle comment submission
  const handleCommentSubmit = async (data: {
    content: string;
    authorName?: string;
    authorEmail?: string;
    authorAffiliation?: string;
  }) => {
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          content: data.content,
          selectedText: selectedText || null,
          pageNumber: currentPage,
          authorName: data.authorName || null,
          authorEmail: data.authorEmail || null,
          authorAffiliation: data.authorAffiliation || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save comment");
      }

      const newComment = await response.json();
      setComments((prev) => [newComment, ...prev]);
      setShowCommentForm(false);
      setSelectedText("");
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error("Error saving comment:", error);
      alert("Failed to save comment. Please try again.");
    }
  };

  // Scroll to page when clicking comment
  const handleCommentClick = useCallback((commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (comment?.pageNumber) {
      const pageEl = pageRefs.current.get(comment.pageNumber);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setCurrentPage(comment.pageNumber);
    }
    setSelectedCommentId(commentId);
  }, [comments]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (numPages || 1)) {
      const pageEl = pageRefs.current.get(page);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setCurrentPage(page);
    }
  };

  // Count comments on visible pages (for the indicator)
  const commentsOnCurrentPage = comments.filter((c) => c.pageNumber === currentPage).length;

  return (
    <div className="flex h-full gap-4 relative">
      {/* PDF Viewer */}
      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b bg-muted/50 flex-wrap gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">&lt;</span>
            </Button>
            <span className="text-xs sm:text-sm whitespace-nowrap">
              {currentPage}/{numPages || "..."}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= (numPages || 1)}
              className="px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">&gt;</span>
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="px-2"
            >
              -
            </Button>
            <span className="text-xs sm:text-sm w-10 sm:w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(2, s + 0.1))}
              className="px-2"
            >
              +
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCommentForm(true)}
              className="hidden sm:inline-flex"
            >
              Add Comment
            </Button>
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommentsSidebar(true)}
              >
                Comments ({comments.length})
              </Button>
            )}
          </div>
        </div>

        {/* PDF Content - Continuous Scroll */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-100 p-4"
          onMouseUp={handleTextSelection}
        >
          <Document
            file={proxiedPdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <p className="text-destructive mb-2">Failed to load PDF</p>
                  <p className="text-sm text-muted-foreground">
                    The document may not be available or the URL may be incorrect.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => window.open(pdfUrl, "_blank")}
                  >
                    Try opening directly
                  </Button>
                </div>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4">
              {numPages &&
                Array.from({ length: numPages }, (_, index) => (
                  <div
                    key={index + 1}
                    ref={(el) => {
                      if (el) pageRefs.current.set(index + 1, el);
                    }}
                    data-page-number={index + 1}
                    className="relative"
                  >
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      className="shadow-lg"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                    {/* Page number label */}
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      Page {index + 1}
                    </div>
                    {/* Comment indicator on page */}
                    {comments.filter((c) => c.pageNumber === index + 1).length > 0 && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        {comments.filter((c) => c.pageNumber === index + 1).length} comment(s)
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Document>
        </div>

        {/* Floating comment form */}
        {showCommentForm && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 lg:right-96 z-50 bg-background border rounded-lg shadow-lg p-4 sm:w-80">
            <h3 className="font-medium mb-2">Add Comment</h3>
            {selectedText && (
              <p className="text-sm text-muted-foreground mb-2 italic border-l-2 border-primary/50 pl-2 line-clamp-3">
                &ldquo;{selectedText}&rdquo;
              </p>
            )}
            <p className="text-xs text-muted-foreground mb-2">
              Page {currentPage}
            </p>
            <CommentForm
              onSubmit={handleCommentSubmit}
              onCancel={() => {
                setShowCommentForm(false);
                setSelectedText("");
              }}
            />
          </div>
        )}
      </div>

      {/* Comment Sidebar - Desktop */}
      <div className="hidden lg:block w-80 border rounded-lg overflow-hidden">
        <CommentSidebar
          documentId={documentId}
          comments={comments}
          selectedCommentId={selectedCommentId}
          onCommentClick={handleCommentClick}
          onCommentAdded={(comment) => {
            setComments((prev) => [comment, ...prev]);
          }}
          onCommentUpdated={(updatedComment) => {
            setComments((prev) =>
              prev.map((c) =>
                c.id === updatedComment.id ? updatedComment : c
              )
            );
          }}
          onCommentDeleted={(commentId) => {
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          }}
        />
      </div>

      {/* Comment Sidebar - Mobile Overlay */}
      {isMobile && showCommentsSidebar && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-background border-l shadow-lg">
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="font-semibold">Comments</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCommentsSidebar(false)}
              >
                Close
              </Button>
            </div>
            <div className="h-[calc(100%-56px)] overflow-auto">
              <CommentSidebar
                documentId={documentId}
                comments={comments}
                selectedCommentId={selectedCommentId}
                onCommentClick={(commentId) => {
                  handleCommentClick(commentId);
                  setShowCommentsSidebar(false);
                }}
                onCommentAdded={(comment) => {
                  setComments((prev) => [comment, ...prev]);
                }}
                onCommentUpdated={(updatedComment) => {
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === updatedComment.id ? updatedComment : c
                    )
                  );
                }}
                onCommentDeleted={(commentId) => {
                  setComments((prev) => prev.filter((c) => c.id !== commentId));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB for adding comments */}
      {isMobile && !showCommentForm && !showCommentsSidebar && (
        <Button
          className="fixed bottom-4 right-4 z-40 rounded-full h-14 w-14 shadow-lg lg:hidden"
          onClick={() => setShowCommentForm(true)}
        >
          +
        </Button>
      )}
    </div>
  );
}
