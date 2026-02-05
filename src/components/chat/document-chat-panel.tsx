"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatWidget } from "./chat-widget";
import { cn } from "@/lib/utils";

interface DocumentChatPanelProps {
  documentId: string;
  documentTitle: string;
}

export function DocumentChatPanel({
  documentId,
  documentTitle,
}: DocumentChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 shadow-lg"
          size="lg"
        >
          Ask AI about this document
        </Button>
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          "transition-all duration-300 border rounded-lg overflow-hidden bg-background",
          isOpen ? "w-96" : "w-0 border-0"
        )}
      >
        {isOpen && (
          <div className="h-full flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Document Assistant</h3>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                  {documentTitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatWidget documentId={documentId} className="h-full" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
