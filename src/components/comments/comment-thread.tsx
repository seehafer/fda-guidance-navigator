"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function CommentThread({
  comment,
  documentId,
  isSelected,
  onClick,
  onReplyAdded,
  onCommentUpdated,
  onCommentDeleted,
}: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if within edit/delete window
  const timeSinceCreation = Date.now() - new Date(comment.createdAt).getTime();
  const canEditOrDelete = timeSinceCreation < EDIT_WINDOW_MS;
  const remainingMinutes = Math.max(0, Math.ceil((EDIT_WINDOW_MS - timeSinceCreation) / 60000));

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

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      setEditContent(comment.content);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update comment");
      }

      const updatedComment = await response.json();
      onCommentUpdated?.(updatedComment);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating comment:", error);
      alert(error instanceof Error ? error.message : "Failed to update comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete comment");
      }

      onCommentDeleted?.(comment.id);
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert(error instanceof Error ? error.message : "Failed to delete comment");
    } finally {
      setIsSubmitting(false);
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
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[60px] text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={isSubmitting || !editContent.trim()}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setEditContent(comment.content);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm">{comment.content}</p>
      )}

      {/* Comment footer */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {formatDate(comment.createdAt)}
        </span>
        <div className="flex gap-1">
          {canEditOrDelete && !isEditing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                title={`Edit (${remainingMinutes} min remaining)`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isSubmitting}
                title={`Delete (${remainingMinutes} min remaining)`}
              >
                Delete
              </Button>
            </>
          )}
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
