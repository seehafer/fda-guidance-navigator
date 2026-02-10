import { NextRequest } from "next/server";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, documentId, sessionId } = body;

    if (!question) {
      return Response.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const queryUrl = `${RAG_SERVICE_URL}/query/stream`;
    console.log(`Querying RAG service at: ${queryUrl}`);

    // Forward to RAG service with streaming
    const response = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        document_id: documentId || null,
        session_id: sessionId || null,
        top_k: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`RAG service error: ${response.status} - ${error}`);
      return Response.json(
        { error: error || "Failed to query documents" },
        { status: response.status }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to process chat request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
