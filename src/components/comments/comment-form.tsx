"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  onSubmit: (data: {
    content: string;
    authorName?: string;
    authorEmail?: string;
    authorAffiliation?: string;
  }) => void;
  onCancel?: () => void;
  parentId?: string;
  placeholder?: string;
}

export function CommentForm({
  onSubmit,
  onCancel,
  parentId,
  placeholder = "Write a comment...",
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorAffiliation, setAuthorAffiliation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        authorName: authorName.trim() || undefined,
        authorEmail: authorEmail.trim() || undefined,
        authorAffiliation: authorAffiliation.trim() || undefined,
      });
      setContent("");
      setAuthorName("");
      setAuthorEmail("");
      setAuthorAffiliation("");
      setShowOptionalFields(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px] resize-none"
        required
      />

      {!showOptionalFields ? (
        <button
          type="button"
          onClick={() => setShowOptionalFields(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add name/email (optional)
        </button>
      ) : (
        <div className="space-y-2">
          <Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name (optional)"
            className="text-sm"
          />
          <Input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="Your email (optional)"
            className="text-sm"
          />
          <Input
            value={authorAffiliation}
            onChange={(e) => setAuthorAffiliation(e.target.value)}
            placeholder="Your affiliation (optional)"
            className="text-sm"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!content.trim() || isSubmitting}>
          {isSubmitting ? "Posting..." : parentId ? "Reply" : "Post Comment"}
        </Button>
      </div>
    </form>
  );
}
