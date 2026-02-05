import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
from contextlib import contextmanager
from typing import Generator

from app.config import get_settings


@contextmanager
def get_db_connection() -> Generator:
    settings = get_settings()
    conn = psycopg2.connect(settings.database_url)
    register_vector(conn)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_db_cursor() -> Generator:
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
