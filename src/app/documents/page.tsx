import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { DocumentList } from "@/components/documents/document-list";
import { TagFilter } from "@/components/documents/tag-filter";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 shrink-0">
        <div className="sticky top-20">
          <h2 className="font-semibold mb-4">Filter by Tags</h2>
          <Suspense fallback={<div>Loading filters...</div>}>
            <TagFilter tags={tags} selectedTagIds={tagIds} />
          </Suspense>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Guidance Documents</h1>
          <span className="text-muted-foreground">
            {total} document{total !== 1 ? "s" : ""}
          </span>
        </div>

        <form className="mb-6">
          <Input
            type="search"
            name="search"
            placeholder="Search documents..."
            defaultValue={params.search}
            className="max-w-md"
          />
        </form>

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
