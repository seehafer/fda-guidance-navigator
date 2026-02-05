"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const centers = [
  { value: "CDER", label: "CDER", description: "Drugs" },
  { value: "CBER", label: "CBER", description: "Biologics" },
  { value: "CDRH", label: "CDRH", description: "Devices" },
  { value: "CFSAN", label: "CFSAN", description: "Food" },
  { value: "CVM", label: "CVM", description: "Veterinary" },
  { value: "CTP", label: "CTP", description: "Tobacco" },
];

export function CenterFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCenter = searchParams.get("center");

  const toggleCenter = (center: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentCenter === center) {
      params.delete("center");
    } else {
      params.set("center", center);
    }
    params.delete("page");

    router.push(`/documents?${params.toString()}`);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">FDA Center</h3>
      <div className="flex flex-wrap gap-1.5">
        {centers.map((center) => (
          <Badge
            key={center.value}
            variant={currentCenter === center.value ? "default" : "outline"}
            className="cursor-pointer transition-colors"
            onClick={() => toggleCenter(center.value)}
            title={center.description}
          >
            {center.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
