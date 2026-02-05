"use client";

import { useState, useCallback, useRef } from "react";
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

export function PdfViewer({ documentId, pdfUrl, initialComments }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [selectedText, setSelectedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setIsLoading(false);
  };

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
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
      setCurrentPage(comment.pageNumber);
    }
    setSelectedCommentId(commentId);
  }, [comments]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (numPages || 1)) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* PDF Viewer */}
      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {numPages || "..."}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= (numPages || 1)}
            >
              Next
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            >
              -
            </Button>
            <span className="text-sm w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(2, s + 0.1))}
            >
              +
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCommentForm(true)}
            >
              Add Comment
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-100 p-4"
          onMouseUp={handleTextSelection}
        >
          <div className="flex justify-center">
            <Document
              file={pdfUrl}
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
              <Page
                pageNumber={currentPage}
                scale={scale}
                className="shadow-lg"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>

          {/* Page indicators for comments */}
          {comments.filter((c) => c.pageNumber === currentPage).length > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
              {comments.filter((c) => c.pageNumber === currentPage).length} comment(s) on this page
            </div>
          )}
        </div>

        {/* Floating comment form */}
        {showCommentForm && (
          <div className="absolute bottom-4 right-96 z-50 bg-background border rounded-lg shadow-lg p-4 w-80">
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

      {/* Comment Sidebar */}
      <div className="w-80 border rounded-lg overflow-hidden">
        <CommentSidebar
          documentId={documentId}
          comments={comments}
          selectedCommentId={selectedCommentId}
          onCommentClick={handleCommentClick}
          onCommentAdded={(comment) => {
            setComments((prev) => [comment, ...prev]);
          }}
        />
      </div>
    </div>
  );
}
