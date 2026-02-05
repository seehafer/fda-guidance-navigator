import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/documents">Browse Documents</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
