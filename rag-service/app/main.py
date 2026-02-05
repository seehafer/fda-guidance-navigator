from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routers import ingest, query

app = FastAPI(
    title="FDA Guidance Navigator RAG Service",
    description="RAG service for querying FDA guidance documents",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router)
app.include_router(query.router)


@app.get("/")
async def root():
    return {
        "service": "FDA Guidance Navigator RAG Service",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
