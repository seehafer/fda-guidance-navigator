import fitz  # PyMuPDF
import tiktoken
from typing import List, Dict, Optional
import httpx
import tempfile
import os

from app.config import get_settings


class ChunkingService:
    def __init__(self):
        settings = get_settings()
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def extract_text_from_pdf(self, pdf_path: str) -> List[Dict]:
        """Extract text from PDF, returning list of {page, text} dicts."""
        doc = fitz.open(pdf_path)
        pages = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if text.strip():
                pages.append({
                    "page": page_num + 1,
                    "text": text.strip()
                })
        doc.close()
        return pages

    async def extract_text_from_url(self, pdf_url: str) -> List[Dict]:
        """Download PDF from URL and extract text."""
        async with httpx.AsyncClient() as client:
            response = await client.get(pdf_url, follow_redirects=True)
            response.raise_for_status()

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(response.content)
                temp_path = f.name

        try:
            return self.extract_text_from_pdf(temp_path)
        finally:
            os.unlink(temp_path)

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.encoding.encode(text))

    def chunk_text(
        self,
        text: str,
        page_start: Optional[int] = None,
        section_title: Optional[str] = None
    ) -> List[Dict]:
        """
        Split text into chunks of approximately chunk_size tokens
        with chunk_overlap token overlap.
        """
        tokens = self.encoding.encode(text)
        chunks = []
        chunk_index = 0

        i = 0
        while i < len(tokens):
            # Get chunk_size tokens
            chunk_end = min(i + self.chunk_size, len(tokens))
            chunk_tokens = tokens[i:chunk_end]
            chunk_text = self.encoding.decode(chunk_tokens)

            chunks.append({
                "content": chunk_text,
                "page_start": page_start,
                "section_title": section_title,
                "chunk_index": chunk_index,
                "token_count": len(chunk_tokens)
            })

            chunk_index += 1
            # Move forward by (chunk_size - overlap)
            i += self.chunk_size - self.chunk_overlap

        return chunks

    def chunk_document(self, pages: List[Dict]) -> List[Dict]:
        """
        Chunk an entire document, preserving page information.
        """
        all_chunks = []
        current_chunk_index = 0

        for page_data in pages:
            page_num = page_data["page"]
            text = page_data["text"]

            page_chunks = self.chunk_text(text, page_start=page_num)

            for chunk in page_chunks:
                chunk["chunk_index"] = current_chunk_index
                all_chunks.append(chunk)
                current_chunk_index += 1

        return all_chunks


chunking_service = ChunkingService()
