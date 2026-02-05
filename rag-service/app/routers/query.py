from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import uuid

from app.database import get_db_cursor
from app.services.retrieval import retrieval_service
from app.services.llm import llm_service

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    question: str
    document_id: Optional[str] = None
    session_id: Optional[str] = None
    top_k: int = 5


class Source(BaseModel):
    document_id: str
    title: str
    fda_document_id: str
    page: Optional[int]
    content_preview: str
    similarity: float


class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    session_id: str


@router.post("/", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """
    Query the document corpus and get an AI-generated response.
    """
    # Search for relevant chunks
    chunks = retrieval_service.search_similar_chunks(
        query=request.question,
        document_id=request.document_id,
        top_k=request.top_k
    )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No relevant documents found. Please ensure documents have been ingested."
        )

    # Get chat history if session exists
    chat_history = []
    if request.session_id:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT role, content
                FROM "ChatMessage"
                WHERE "sessionId" = %s
                ORDER BY "createdAt" ASC
                LIMIT 10
                """,
                (request.session_id,)
            )
            chat_history = [
                {"role": row["role"], "content": row["content"]}
                for row in cursor.fetchall()
            ]

    # Generate response
    answer = await llm_service.generate_response(
        question=request.question,
        chunks=chunks,
        chat_history=chat_history
    )

    # Create or use existing session
    session_id = request.session_id or str(uuid.uuid4())

    # Save messages to session
    with get_db_cursor() as cursor:
        # Ensure session exists
        if not request.session_id:
            cursor.execute(
                """
                INSERT INTO "ChatSession" (id, "createdAt", "updatedAt")
                VALUES (%s, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                (session_id,)
            )

        # Save user message
        cursor.execute(
            """
            INSERT INTO "ChatMessage" (id, "sessionId", role, content, "createdAt")
            VALUES (%s, %s, %s, %s, NOW())
            """,
            (str(uuid.uuid4()), session_id, "user", request.question)
        )

        # Save assistant message
        cursor.execute(
            """
            INSERT INTO "ChatMessage" (id, "sessionId", role, content, "createdAt")
            VALUES (%s, %s, %s, %s, NOW())
            """,
            (str(uuid.uuid4()), session_id, "assistant", answer)
        )

        # Update session timestamp
        cursor.execute(
            """
            UPDATE "ChatSession" SET "updatedAt" = NOW() WHERE id = %s
            """,
            (session_id,)
        )

    # Build sources
    sources = [
        Source(
            document_id=chunk["document_id"],
            title=chunk["title"],
            fda_document_id=chunk["fda_document_id"],
            page=chunk["page_start"],
            content_preview=chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"],
            similarity=chunk["similarity"]
        )
        for chunk in chunks
    ]

    return QueryResponse(
        answer=answer,
        sources=sources,
        session_id=session_id
    )


@router.post("/stream")
async def query_documents_stream(request: QueryRequest):
    """
    Query with streaming response.
    """
    # Search for relevant chunks
    chunks = retrieval_service.search_similar_chunks(
        query=request.question,
        document_id=request.document_id,
        top_k=request.top_k
    )

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No relevant documents found."
        )

    # Get chat history if session exists
    chat_history = []
    if request.session_id:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT role, content
                FROM "ChatMessage"
                WHERE "sessionId" = %s
                ORDER BY "createdAt" ASC
                LIMIT 10
                """,
                (request.session_id,)
            )
            chat_history = [
                {"role": row["role"], "content": row["content"]}
                for row in cursor.fetchall()
            ]

    session_id = request.session_id or str(uuid.uuid4())

    async def generate():
        full_response = ""

        # Send sources first
        sources = [
            {
                "document_id": chunk["document_id"],
                "title": chunk["title"],
                "fda_document_id": chunk["fda_document_id"],
                "page": chunk["page_start"],
                "content_preview": chunk["content"][:200],
                "similarity": chunk["similarity"]
            }
            for chunk in chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'session_id': session_id})}\n\n"

        # Stream response
        async for text in llm_service.generate_response_stream(
            question=request.question,
            chunks=chunks,
            chat_history=chat_history
        ):
            full_response += text
            yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

        # Save to database after streaming completes
        with get_db_cursor() as cursor:
            if not request.session_id:
                cursor.execute(
                    """
                    INSERT INTO "ChatSession" (id, "createdAt", "updatedAt")
                    VALUES (%s, NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (session_id,)
                )

            cursor.execute(
                """
                INSERT INTO "ChatMessage" (id, "sessionId", role, content, "createdAt")
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (str(uuid.uuid4()), session_id, "user", request.question)
            )

            cursor.execute(
                """
                INSERT INTO "ChatMessage" (id, "sessionId", role, content, "createdAt")
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (str(uuid.uuid4()), session_id, "assistant", full_response)
            )

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@router.get("/sessions/{session_id}")
async def get_session_history(session_id: str):
    """Get chat history for a session."""
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, role, content, "createdAt"
            FROM "ChatMessage"
            WHERE "sessionId" = %s
            ORDER BY "createdAt" ASC
            """,
            (session_id,)
        )
        messages = cursor.fetchall()

    if not messages:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "messages": [
            {
                "id": msg["id"],
                "role": msg["role"],
                "content": msg["content"],
                "created_at": msg["createdAt"].isoformat()
            }
            for msg in messages
        ]
    }
