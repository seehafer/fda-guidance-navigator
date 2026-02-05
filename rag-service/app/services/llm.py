from anthropic import Anthropic
from typing import List, Dict, AsyncGenerator
import json

from app.config import get_settings


class LLMService:
    def __init__(self):
        settings = get_settings()
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.llm_model
        self.max_tokens = settings.llm_max_tokens

    def build_context(self, chunks: List[Dict]) -> str:
        """Build context string from retrieved chunks."""
        context_parts = []
        for i, chunk in enumerate(chunks):
            source = f"[Source {i + 1}]"
            if chunk.get("title"):
                source += f" {chunk['title']}"
            if chunk.get("page_start"):
                source += f" (Page {chunk['page_start']})"
            context_parts.append(f"{source}\n{chunk['content']}")
        return "\n\n---\n\n".join(context_parts)

    def build_system_prompt(self, context: str) -> str:
        """Build the system prompt with context."""
        return f"""You are an expert assistant specializing in FDA guidance documents. Your role is to help users understand FDA regulations, guidance, and compliance requirements.

When answering questions:
1. Base your answers primarily on the provided context from FDA guidance documents
2. Cite your sources using [Source N] notation when referencing specific information
3. If the context doesn't contain enough information to fully answer the question, acknowledge this
4. Provide clear, accurate, and helpful responses
5. If asked about something outside the scope of FDA guidance, politely redirect to relevant topics

Here is the relevant context from FDA guidance documents:

{context}

Remember to cite sources when using information from the context above."""

    async def generate_response(
        self,
        question: str,
        chunks: List[Dict],
        chat_history: List[Dict] = None
    ) -> str:
        """Generate a response using Claude."""
        context = self.build_context(chunks)
        system_prompt = self.build_system_prompt(context)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        messages.append({
            "role": "user",
            "content": question
        })

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=messages
        )

        return response.content[0].text

    async def generate_response_stream(
        self,
        question: str,
        chunks: List[Dict],
        chat_history: List[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response using Claude."""
        context = self.build_context(chunks)
        system_prompt = self.build_system_prompt(context)

        messages = []
        if chat_history:
            for msg in chat_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        messages.append({
            "role": "user",
            "content": question
        })

        with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=messages
        ) as stream:
            for text in stream.text_stream:
                yield text


llm_service = LLMService()
