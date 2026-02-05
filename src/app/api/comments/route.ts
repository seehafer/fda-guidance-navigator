import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      documentId,
      content,
      highlightPosition,
      selectedText,
      pageNumber,
      parentId,
      authorName,
      authorEmail,
      authorAffiliation,
    } = body;

    // Validate required fields
    if (!documentId || !content) {
      return NextResponse.json(
        { error: "documentId and content are required" },
        { status: 400 }
      );
    }

    // Verify document exists
    const document = await prisma.guidanceDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }

      // Don't allow nested replies (only 1 level deep)
      if (parentComment.parentId) {
        return NextResponse.json(
          { error: "Cannot reply to a reply" },
          { status: 400 }
        );
      }
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        documentId,
        content,
        highlightPosition: highlightPosition || null,
        selectedText: selectedText || null,
        pageNumber: pageNumber || null,
        parentId: parentId || null,
        authorName: authorName || null,
        authorEmail: authorEmail || null,
        authorAffiliation: authorAffiliation || null,
      },
      include: {
        replies: true,
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: {
        documentId,
        parentId: null, // Only top-level comments
        isVisible: true,
      },
      include: {
        replies: {
          where: { isVisible: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}
