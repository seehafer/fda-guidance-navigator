"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the PDF viewer to avoid SSR issues with pdfjs
const PdfViewer = dynamic(() => import("./pdf-viewer").then((mod) => mod.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="space-y-4 w-full max-w-2xl">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    </div>
  ),
});

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

interface PdfViewerWrapperProps {
  documentId: string;
  pdfUrl: string;
  initialComments: Comment[];
}

export function PdfViewerWrapper({ documentId, pdfUrl, initialComments }: PdfViewerWrapperProps) {
  return (
    <PdfViewer
      documentId={documentId}
      pdfUrl={pdfUrl}
      initialComments={initialComments}
    />
  );
}
