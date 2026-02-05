"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const statuses = [
  { value: "FINAL", label: "Final", color: "bg-green-100 text-green-800" },
  { value: "DRAFT", label: "Draft", color: "bg-yellow-100 text-yellow-800" },
  { value: "WITHDRAWN", label: "Withdrawn", color: "bg-red-100 text-red-800" },
  { value: "SUPERSEDED", label: "Superseded", color: "bg-gray-100 text-gray-800" },
];

export function StatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status");

  const toggleStatus = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentStatus === status) {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    params.delete("page");

    router.push(`/documents?${params.toString()}`);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Status</h3>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((status) => (
          <Badge
            key={status.value}
            variant={currentStatus === status.value ? "default" : "outline"}
            className={`cursor-pointer transition-colors ${
              currentStatus === status.value ? "" : status.color
            }`}
            onClick={() => toggleStatus(status.value)}
          >
            {status.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
