import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    // Validate URL is from FDA (security measure)
    const parsedUrl = new URL(url);
    const allowedHosts = ["www.fda.gov", "fda.gov"];

    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return new Response("Only FDA URLs are allowed", { status: 403 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "FDA-Guidance-Navigator/1.0",
      },
    });

    if (!response.ok) {
      return new Response(`Failed to fetch PDF: ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type");
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Error proxying PDF:", error);
    return new Response("Failed to fetch PDF", { status: 500 });
  }
}
