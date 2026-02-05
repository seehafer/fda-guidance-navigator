"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Document {
  id: string;
  title: string;
  fdaDocumentId: string;
  issueDate: Date;
  status: string;
  summary: string | null;
  center: string;
  tags: {
    tag: {
      id: string;
      name: string;
      category: string;
    };
  }[];
}

interface DocumentListProps {
  documents: Document[];
  currentPage: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  FINAL: "bg-green-100 text-green-800",
  WITHDRAWN: "bg-red-100 text-red-800",
  SUPERSEDED: "bg-gray-100 text-gray-800",
};

export function DocumentList({ documents, currentPage, totalPages }: DocumentListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/documents?${params.toString()}`);
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No documents found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card key={doc.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Link href={`/documents/${doc.id}`}>
                  <CardTitle className="text-lg hover:underline cursor-pointer">
                    {doc.title}
                  </CardTitle>
                </Link>
                <CardDescription>
                  {doc.fdaDocumentId} · {doc.center} ·{" "}
                  {new Date(doc.issueDate).toLocaleDateString()}
                </CardDescription>
              </div>
              <Badge className={statusColors[doc.status] || "bg-gray-100"}>
                {doc.status.toLowerCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {doc.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {doc.summary}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {doc.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
