"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CommentForm } from "./comment-form";

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

interface CommentThreadProps {
  comment: Comment;
  documentId: string;
  isSelected: boolean;
  onClick: () => void;
  onReplyAdded: (reply: Comment) => void;
}

export function CommentThread({
  comment,
  documentId,
  isSelected,
  onClick,
  onReplyAdded,
}: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReplySubmit = async (data: {
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
          parentId: comment.id,
          authorName: data.authorName || null,
          authorEmail: data.authorEmail || null,
          authorAffiliation: data.authorAffiliation || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save reply");
      }

      const newReply = await response.json();
      onReplyAdded(newReply);
      setShowReplyForm(false);
    } catch (error) {
      console.error("Error saving reply:", error);
      alert("Failed to save reply. Please try again.");
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? "Just now" : `${minutes} min ago`;
      }
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    return d.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "rounded-lg p-3 cursor-pointer transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Selected text quote */}
      {comment.selectedText && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2 mb-2 line-clamp-2">
          &ldquo;{comment.selectedText}&rdquo;
        </p>
      )}

      {/* Comment header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span className="font-medium text-foreground">
          {comment.authorName || "Anonymous"}
          {comment.authorAffiliation && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {comment.authorAffiliation}
            </span>
          )}
        </span>
        {comment.pageNumber && (
          <span className="text-xs">Page {comment.pageNumber}</span>
        )}
      </div>

      {/* Comment content */}
      <p className="text-sm">{comment.content}</p>

      {/* Comment footer */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {formatDate(comment.createdAt)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setShowReplyForm(!showReplyForm);
          }}
        >
          Reply
        </Button>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-muted space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {reply.authorName || "Anonymous"}
                </span>
                <span>·</span>
                <span>{formatDate(reply.createdAt)}</span>
              </div>
              <p className="mt-1">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div
          className="mt-3 pt-3 border-t"
          onClick={(e) => e.stopPropagation()}
        >
          <CommentForm
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyForm(false)}
            parentId={comment.id}
            placeholder="Write a reply..."
          />
        </div>
      )}
    </div>
  );
}
