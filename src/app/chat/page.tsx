import { ChatWidget } from "@/components/chat/chat-widget";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">FDA Guidance Assistant</h1>
          <p className="text-muted-foreground">
            Ask questions about FDA guidance documents. The assistant will search
            across all documents and provide answers with citations.
          </p>
        </div>
        <div className="flex-1 border rounded-lg overflow-hidden">
          <ChatWidget />
        </div>
      </div>
    </div>
  );
}
