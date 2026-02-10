from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db_cursor
from app.services.chunking import chunking_service
from app.services.embeddings import embedding_service

router = APIRouter(prefix="/ingest", tags=["ingest"])


class IngestRequest(BaseModel):
    document_id: str
    pdf_url: str


class IngestResponse(BaseModel):
    document_id: str
    chunks_created: int
    status: str


async def process_document(document_id: str, pdf_url: str):
    """Background task to process a document."""
    try:
        # Extract text from PDF
        pages = await chunking_service.extract_text_from_url(pdf_url)

        if not pages:
            print(f"No text extracted from document {document_id}")
            return

        # Chunk the document
        chunks = chunking_service.chunk_document(pages)

        # Generate embeddings for all chunks
        chunk_texts = [chunk["content"] for chunk in chunks]
        embeddings = embedding_service.embed_texts(chunk_texts)

        # Store chunks with embeddings
        with get_db_cursor() as cursor:
            # Delete existing chunks for this document
            cursor.execute(
                'DELETE FROM "DocumentChunk" WHERE "documentId" = %s',
                (document_id,)
            )

            # Insert new chunks
            for chunk, embedding in zip(chunks, embeddings):
                chunk_id = str(uuid.uuid4())
                embedding_str = f"[{','.join(map(str, embedding))}]"

                cursor.execute(
                    """
                    INSERT INTO "DocumentChunk"
                    (id, "documentId", content, "pageStart", "sectionTitle", "chunkIndex", embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                    """,
                    (
                        chunk_id,
                        document_id,
                        chunk["content"],
                        chunk.get("page_start"),
                        chunk.get("section_title"),
                        chunk["chunk_index"],
                        embedding_str
                    )
                )

        print(f"Successfully processed document {document_id}: {len(chunks)} chunks created")

    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        raise


@router.post("/document", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    background_tasks: BackgroundTasks
):
    """
    Ingest a document: extract text, chunk, and generate embeddings.
    Processing happens in the background.
    """
    # Verify document exists
    with get_db_cursor() as cursor:
        cursor.execute(
            'SELECT id FROM "GuidanceDocument" WHERE id = %s',
            (request.document_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Document not found")

    # Queue background processing
    background_tasks.add_task(
        process_document,
        request.document_id,
        request.pdf_url
    )

    return IngestResponse(
        document_id=request.document_id,
        chunks_created=0,
        status="processing"
    )


@router.post("/all")
async def ingest_all_documents(background_tasks: BackgroundTasks):
    """
    Ingest all documents that haven't been processed yet (background).
    """
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT gd.id, gd."pdfUrl"
            FROM "GuidanceDocument" gd
            WHERE NOT EXISTS (
                SELECT 1 FROM "DocumentChunk" dc
                WHERE dc."documentId" = gd.id
            )
            AND gd."pdfUrl" IS NOT NULL
            """
        )
        documents = cursor.fetchall()

    for doc in documents:
        background_tasks.add_task(
            process_document,
            doc["id"],
            doc["pdfUrl"]
        )

    return {
        "status": "processing",
        "documents_queued": len(documents)
    }


@router.post("/all/sync")
async def ingest_all_documents_sync():
    """
    Ingest all pending documents synchronously (waits for completion).
    Returns detailed results for each document.
    """
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT gd.id, gd.title, gd."pdfUrl"
            FROM "GuidanceDocument" gd
            WHERE NOT EXISTS (
                SELECT 1 FROM "DocumentChunk" dc
                WHERE dc."documentId" = gd.id
            )
            AND gd."pdfUrl" IS NOT NULL
            """
        )
        documents = cursor.fetchall()

    results = []
    for i, doc in enumerate(documents):
        print(f"[{i+1}/{len(documents)}] Processing: {doc['title'][:60]}...")
        try:
            await process_document(doc["id"], doc["pdfUrl"])

            # Get chunk count
            with get_db_cursor() as cursor:
                cursor.execute(
                    'SELECT COUNT(*) as count FROM "DocumentChunk" WHERE "documentId" = %s',
                    (doc["id"],)
                )
                chunk_count = cursor.fetchone()["count"]

            results.append({
                "id": doc["id"],
                "title": doc["title"],
                "status": "completed",
                "chunks_count": chunk_count,
                "error": None
            })
            print(f"  ✓ Created {chunk_count} chunks")
        except Exception as e:
            results.append({
                "id": doc["id"],
                "title": doc["title"],
                "status": "failed",
                "chunks_count": 0,
                "error": str(e)
            })
            print(f"  ✗ Error: {e}")

    completed = sum(1 for r in results if r["status"] == "completed")
    failed = sum(1 for r in results if r["status"] == "failed")

    return {
        "summary": {
            "processed": len(results),
            "completed": completed,
            "failed": failed
        },
        "results": results
    }


@router.get("/status/{document_id}")
async def get_ingest_status(document_id: str):
    """Get the ingestion status for a document."""
    with get_db_cursor() as cursor:
        cursor.execute(
            'SELECT COUNT(*) as count FROM "DocumentChunk" WHERE "documentId" = %s',
            (document_id,)
        )
        result = cursor.fetchone()

    return {
        "document_id": document_id,
        "chunks_count": result["count"],
        "status": "completed" if result["count"] > 0 else "pending"
    }


@router.get("/status")
async def get_all_ingest_status():
    """Get ingestion status for all documents."""
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
                gd.id,
                gd.title,
                gd."fdaDocumentId",
                gd.center,
                COALESCE(dc.chunk_count, 0) as chunks_count,
                CASE WHEN dc.chunk_count > 0 THEN 'completed' ELSE 'pending' END as status
            FROM "GuidanceDocument" gd
            LEFT JOIN (
                SELECT "documentId", COUNT(*) as chunk_count
                FROM "DocumentChunk"
                GROUP BY "documentId"
            ) dc ON gd.id = dc."documentId"
            ORDER BY dc.chunk_count DESC NULLS LAST, gd.title
            """
        )
        documents = cursor.fetchall()

    completed = sum(1 for d in documents if d["status"] == "completed")
    pending = sum(1 for d in documents if d["status"] == "pending")

    return {
        "summary": {
            "total": len(documents),
            "completed": completed,
            "pending": pending
        },
        "documents": [
            {
                "id": doc["id"],
                "title": doc["title"],
                "fda_document_id": doc["fdaDocumentId"],
                "center": doc["center"],
                "chunks_count": doc["chunks_count"],
                "status": doc["status"]
            }
            for doc in documents
        ]
    }
