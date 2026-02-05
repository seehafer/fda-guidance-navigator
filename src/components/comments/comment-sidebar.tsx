"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CommentThread } from "./comment-thread";
import { cn } from "@/lib/utils";

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

interface CommentSidebarProps {
  documentId: string;
  comments: Comment[];
  selectedCommentId: string | null;
  onCommentClick: (commentId: string) => void;
  onCommentAdded: (comment: Comment) => void;
}

export function CommentSidebar({
  documentId,
  comments,
  selectedCommentId,
  onCommentClick,
  onCommentAdded,
}: CommentSidebarProps) {
  const [sortBy, setSortBy] = useState<"newest" | "page">("newest");

  // Sort comments
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "page") {
      const pageA = a.pageNumber || 0;
      const pageB = b.pageNumber || 0;
      if (pageA !== pageB) return pageA - pageB;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Comments ({comments.length})</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "page")}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="newest">Newest first</option>
            <option value="page">By page</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select text in the PDF to add a comment
        </p>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sortedComments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Be the first to comment on this document
              </p>
            </div>
          ) : (
            sortedComments.map((comment) => (
              <div key={comment.id}>
                <CommentThread
                  comment={comment}
                  documentId={documentId}
                  isSelected={selectedCommentId === comment.id}
                  onClick={() => onCommentClick(comment.id)}
                  onReplyAdded={(reply) => {
                    // Update the comment with new reply
                    onCommentAdded({
                      ...comment,
                      replies: [...comment.replies, reply],
                    });
                  }}
                />
                <Separator className="mt-3" />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
