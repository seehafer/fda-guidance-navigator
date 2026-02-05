"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
}

const categoryLabels: Record<string, string> = {
  PRODUCT_AREA: "Product Area",
  TOPIC: "Topic",
  REGULATORY_TYPE: "Regulatory Type",
};

export function TagFilter({ tags, selectedTagIds }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  const toggleTag = (tagId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTags = params.getAll("tags");

    if (currentTags.includes(tagId)) {
      params.delete("tags");
      currentTags
        .filter((t) => t !== tagId)
        .forEach((t) => params.append("tags", t));
    } else {
      params.append("tags", tagId);
    }

    params.delete("page");
    router.push(`/documents?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tags");
    params.delete("page");
    router.push(`/documents?${params.toString()}`);
  };

  if (tags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tags available.</p>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-4 pr-4">
        {selectedTagIds.length > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all filters
          </button>
        )}

        {Object.entries(tagsByCategory).map(([category, categoryTags], index) => (
          <div key={category}>
            {index > 0 && <Separator className="my-4" />}
            <h3 className="text-sm font-medium mb-2">
              {categoryLabels[category] || category}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {categoryTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
