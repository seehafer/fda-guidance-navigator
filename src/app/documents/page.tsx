import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { DocumentList } from "@/components/documents/document-list";
import { TagFilter } from "@/components/documents/tag-filter";
import { SearchForm } from "@/components/documents/search-form";
import { StatusFilter } from "@/components/documents/status-filter";
import { CenterFilter } from "@/components/documents/center-filter";
import { Separator } from "@/components/ui/separator";

interface DocumentsPageProps {
  searchParams: Promise<{
    search?: string;
    tags?: string | string[];
    status?: string;
    center?: string;
    page?: string;
  }>;
}

async function getDocuments(params: {
  search?: string;
  tagIds?: string[];
  status?: string;
  center?: string;
  page?: number;
}) {
  const { search, tagIds, status, center, page = 1 } = params;
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
      { fdaDocumentId: { contains: search, mode: "insensitive" } },
    ];
  }

  if (tagIds && tagIds.length > 0) {
    where.tags = {
      some: {
        tagId: { in: tagIds },
      },
    };
  }

  if (status) {
    where.status = status;
  }

  if (center) {
    where.center = center;
  }

  const [documents, total] = await Promise.all([
    prisma.guidanceDocument.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { issueDate: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.guidanceDocument.count({ where }),
  ]);

  return {
    documents,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getTags() {
  return prisma.tag.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const tagIds = params.tags
    ? Array.isArray(params.tags)
      ? params.tags
      : [params.tags]
    : [];

  const [{ documents, total, page, totalPages }, tags] = await Promise.all([
    getDocuments({
      search: params.search,
      tagIds,
      status: params.status,
      center: params.center,
      page: params.page ? parseInt(params.page) : 1,
    }),
    getTags(),
  ]);

  // Check if any filters are active
  const hasActiveFilters =
    params.search || tagIds.length > 0 || params.status || params.center;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-72 shrink-0">
        <div className="sticky top-20 space-y-6">
          <Suspense fallback={<div>Loading filters...</div>}>
            <StatusFilter />
            <Separator />
            <CenterFilter />
            <Separator />
            <div>
              <h3 className="text-sm font-medium mb-2">Topics</h3>
              <TagFilter tags={tags} selectedTagIds={tagIds} />
            </div>
          </Suspense>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Guidance Documents</h1>
            <p className="text-muted-foreground">
              {total} document{total !== 1 ? "s" : ""}
              {hasActiveFilters ? " matching filters" : ""}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Suspense fallback={<div>Loading search...</div>}>
            <SearchForm />
          </Suspense>
        </div>

        <Suspense fallback={<div>Loading documents...</div>}>
          <DocumentList
            documents={documents}
            currentPage={page}
            totalPages={totalPages}
          />
        </Suspense>
      </div>
    </div>
  );
}
