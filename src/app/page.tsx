import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="max-w-4xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          FDA Guidance Navigator
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Browse, view, and discuss FDA guidance documents. Get instant answers
          about regulatory requirements with our AI-powered assistant.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/documents">Browse Documents</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/chat">Ask AI Assistant</Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Browse & Filter</CardTitle>
            <CardDescription>
              Find guidance documents by topic, product area, or regulatory type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Search through FDA guidance documents with powerful filtering by
              FDA-defined tags and categories.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View & Comment</CardTitle>
            <CardDescription>
              Read PDFs in your browser and discuss with the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Highlight text, add comments, and participate in threaded discussions
              directly on the guidance documents.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>
              Get answers about FDA guidance instantly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask questions in plain language and get accurate answers with
              citations from the official guidance documents.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
