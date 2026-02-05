from typing import List, Dict
import numpy as np

from app.database import get_db_cursor
from app.services.embeddings import embedding_service


class RetrievalService:
    def __init__(self, top_k: int = 5):
        self.top_k = top_k

    def search_similar_chunks(
        self,
        query: str,
        document_id: str = None,
        top_k: int = None
    ) -> List[Dict]:
        """
        Search for chunks similar to the query.
        Optionally filter by document_id.
        """
        k = top_k or self.top_k

        # Generate query embedding
        query_embedding = embedding_service.embed_text(query)
        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        with get_db_cursor() as cursor:
            if document_id:
                cursor.execute(
                    """
                    SELECT
                        dc.id,
                        dc."documentId",
                        dc.content,
                        dc."pageStart",
                        dc."sectionTitle",
                        dc."chunkIndex",
                        gd.title,
                        gd."fdaDocumentId",
                        1 - (dc.embedding <=> %s::vector) as similarity
                    FROM "DocumentChunk" dc
                    JOIN "GuidanceDocument" gd ON dc."documentId" = gd.id
                    WHERE dc."documentId" = %s
                    AND dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (embedding_str, document_id, embedding_str, k)
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        dc.id,
                        dc."documentId",
                        dc.content,
                        dc."pageStart",
                        dc."sectionTitle",
                        dc."chunkIndex",
                        gd.title,
                        gd."fdaDocumentId",
                        1 - (dc.embedding <=> %s::vector) as similarity
                    FROM "DocumentChunk" dc
                    JOIN "GuidanceDocument" gd ON dc."documentId" = gd.id
                    WHERE dc.embedding IS NOT NULL
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (embedding_str, embedding_str, k)
                )

            results = cursor.fetchall()

        return [
            {
                "id": row["id"],
                "document_id": row["documentId"],
                "content": row["content"],
                "page_start": row["pageStart"],
                "section_title": row["sectionTitle"],
                "chunk_index": row["chunkIndex"],
                "title": row["title"],
                "fda_document_id": row["fdaDocumentId"],
                "similarity": float(row["similarity"])
            }
            for row in results
        ]


retrieval_service = RetrievalService()
