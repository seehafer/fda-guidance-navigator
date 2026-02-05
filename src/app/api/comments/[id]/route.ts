import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Get a single comment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        replies: {
          where: { isVisible: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error fetching comment:", error);
    return NextResponse.json(
      { error: "Failed to fetch comment" },
      { status: 500 }
    );
  }
}

// Update a comment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Check if comment exists
    const existingComment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if comment is within edit window (e.g., 15 minutes)
    const editWindowMs = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreation = Date.now() - existingComment.createdAt.getTime();

    if (timeSinceCreation > editWindowMs) {
      return NextResponse.json(
        { error: "Comment can no longer be edited (15 minute window expired)" },
        { status: 403 }
      );
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { content: content.trim() },
      include: {
        replies: {
          where: { isVisible: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// Delete a comment (soft delete by setting isVisible to false)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if comment exists
    const existingComment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if comment is within delete window (e.g., 15 minutes)
    const deleteWindowMs = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreation = Date.now() - existingComment.createdAt.getTime();

    if (timeSinceCreation > deleteWindowMs) {
      return NextResponse.json(
        { error: "Comment can no longer be deleted (15 minute window expired)" },
        { status: 403 }
      );
    }

    // Soft delete - set isVisible to false
    await prisma.comment.update({
      where: { id },
      data: { isVisible: false },
    });

    // Also hide any replies
    await prisma.comment.updateMany({
      where: { parentId: id },
      data: { isVisible: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
