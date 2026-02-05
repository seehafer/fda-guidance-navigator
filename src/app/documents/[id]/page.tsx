import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PdfViewerWrapper } from "@/components/pdf/pdf-viewer-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getDocument(id: string) {
  const document = await prisma.guidanceDocument.findUnique({
    where: { id },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      comments: {
        where: {
          parentId: null,
          isVisible: true,
        },
        include: {
          replies: {
            where: { isVisible: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return document;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  FINAL: "bg-green-100 text-green-800",
  WITHDRAWN: "bg-red-100 text-red-800",
  SUPERSEDED: "bg-gray-100 text-gray-800",
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;
  const document = await getDocument(id);

  if (!document) {
    notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Document Header */}
      <div className="border-b pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/documents">&larr; Back to Documents</Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold">{document.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{document.fdaDocumentId}</span>
              <span>·</span>
              <span>{document.center}</span>
              <span>·</span>
              <span>{new Date(document.issueDate).toLocaleDateString()}</span>
              <Badge className={statusColors[document.status] || "bg-gray-100"}>
                {document.status.toLowerCase()}
              </Badge>
            </div>
            {document.summary && (
              <p className="text-sm text-muted-foreground max-w-3xl">
                {document.summary}
              </p>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {document.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={document.pdfUrl} target="_blank" rel="noopener noreferrer">
                Open PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <PdfViewerWrapper
          documentId={document.id}
          pdfUrl={document.pdfUrl}
          initialComments={document.comments.map((c) => ({
            ...c,
            replies: c.replies.map((r) => ({ ...r, replies: [] })),
          }))}
        />
      </div>
    </div>
  );
}
