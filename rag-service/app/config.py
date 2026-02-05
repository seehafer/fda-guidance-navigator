from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    openai_api_key: str
    anthropic_api_key: str

    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    chunk_size: int = 512
    chunk_overlap: int = 50

    llm_model: str = "claude-sonnet-4-20250514"
    llm_max_tokens: int = 4096

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
