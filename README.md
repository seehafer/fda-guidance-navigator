# FDA Guidance Navigator

A web application for browsing, viewing, and discussing FDA guidance documents with an AI-powered Q&A chatbot.

## Features

- **Document Browser**: View and filter FDA guidance documents by status, FDA center, and topics
- **PDF Viewer**: In-browser preview of guidance document PDFs
- **Commenting System**: Inline commenting on PDFs with threaded replies (anonymous by default)
- **AI Chatbot**: RAG-powered assistant that answers questions about FDA guidance documents with citations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL 17 with pgvector |
| ORM | Prisma 7 |
| PDF Viewer | react-pdf |
| RAG Service | Python FastAPI |
| Embeddings | OpenAI text-embedding-3-small |
| LLM | Anthropic Claude |

## Prerequisites

- Node.js 18+
- PostgreSQL 17 with pgvector extension
- Python 3.10+
- OpenAI API key (for embeddings)
- Anthropic API key (for chat)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/seehafer/fda-guidance-navigator.git
cd fda-guidance-navigator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

Install PostgreSQL and pgvector:

```bash
# macOS with Homebrew
brew install postgresql@17
brew install pgvector

# Start PostgreSQL
brew services start postgresql@17
```

Create the database:

```bash
createdb fda_guidance
psql fda_guidance -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your database URL and API keys:

```env
DATABASE_URL="postgresql://localhost:5432/fda_guidance"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
RAG_SERVICE_URL="http://localhost:8000"
```

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Seed the database

```bash
npx tsx scripts/import-fda-documents.ts
```

### 7. Start the Next.js development server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### 8. Set up the RAG service (for AI chat)

```bash
cd rag-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` in the rag-service directory:

```env
DATABASE_URL="postgresql://localhost:5432/fda_guidance"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

Start the RAG service:

```bash
uvicorn app.main:app --reload
```

### 9. Ingest documents for AI search

Trigger document ingestion (processes PDFs into embeddings):

```bash
curl -X POST http://localhost:8000/ingest/all
```

## Project Structure

```
fda-guidance-navigator/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── app/
│   │   ├── api/                # API routes
│   │   ├── chat/               # AI chat page
│   │   └── documents/          # Document browser and viewer
│   ├── components/
│   │   ├── chat/               # Chat UI components
│   │   ├── comments/           # Commenting system
│   │   ├── documents/          # Document list and filters
│   │   ├── pdf/                # PDF viewer
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       └── db.ts               # Prisma client
├── rag-service/                # Python RAG microservice
│   ├── app/
│   │   ├── routers/            # FastAPI routes
│   │   └── services/           # Chunking, embeddings, retrieval
│   └── requirements.txt
└── scripts/
    └── import-fda-documents.ts # Document importer
```

## API Endpoints

### Next.js API

- `GET /api/comments?documentId=xxx` - Get comments for a document
- `POST /api/comments` - Create a comment
- `PATCH /api/comments/[id]` - Update a comment (15 min window)
- `DELETE /api/comments/[id]` - Delete a comment (15 min window)
- `POST /api/chat` - Stream chat responses (proxies to RAG service)

### RAG Service API

- `POST /ingest/document` - Ingest a single document
- `POST /ingest/all` - Ingest all unprocessed documents
- `GET /ingest/status/{document_id}` - Check ingestion status
- `POST /query/` - Query documents (non-streaming)
- `POST /query/stream` - Query documents (streaming)
- `GET /query/sessions/{session_id}` - Get chat history

## Development

```bash
# Run Next.js dev server
npm run dev

# Run RAG service
cd rag-service && uvicorn app.main:app --reload

# Run Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name
```

## License

MIT
