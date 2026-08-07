Open WebUI is a self-hosted ChatGPT-style interface for talking to local models (Ollama, llama.cpp) and remote APIs (OpenAI, Anthropic, Google, OpenRouter) through a single web app. It ships as a Python package plus a Docker image and is the de facto front end for an Ollama install on a home server.

## Why it matters

- **One UI for every model backend.** Switch between local Ollama, an OpenAI key, and an Anthropic key without leaving the page. Conversations and personas are shared across backends.
- **Chat UX that doesn't feel like a demo.** Markdown, code blocks with syntax highlighting, image inputs, file uploads, voice input, multi-user auth, RBAC, and a model marketplace pattern out of the box.
- **First-class Ollama integration.** A model picker that lists whatever `ollama list` returns, model pulling from inside the chat, automatic discovery of new local models.
- **Retrieval and tools without leaving the UI.** Built-in document upload for RAG, web search, custom function calling, and a "workspace" pattern for shared knowledge.

## How it works

The Python backend (FastAPI + SQLAlchemy) stores users, conversations, and uploaded documents in SQLite or PostgreSQL. The frontend is Svelte. When a user sends a message, the backend translates the request into the chosen provider's format — `chat/completions` for OpenAI, `/api/chat` for Ollama — and streams the response back through Server-Sent Events. Documents uploaded to a workspace are chunked, embedded (via Ollama's `/api/embed` or an external embedding model), and stored in ChromaDB for retrieval-augmented generation.

The "model workspace" pattern lets a team share a common set of system prompts, documents, and tool definitions — closer to a lightweight ChatGPT Team clone than a chatbot demo.

## Caveats

- **Single-tenant by default, multi-tenant with effort.** Auth and user management are real, but RBAC for org-level features is a paid add-on (or a self-hosted configuration that's worth budgeting time for).
- **Stateful conversations are stored in the DB.** Rotating the database or moving servers means re-indexing documents. Plan backups for `openwebui.db` and any Chroma data directory.
- **The Docker image runs as root by default.** Use a non-root user and a named volume for `/app/backend/data` in production; do not bind-mount to a host path that contains other workloads.
- **Document chunking is opinionated.** PDFs and Markdown work well; complex layouts (multi-column, embedded tables) may need a different chunker.

## Deployment notes

```bash
# Quick start with Ollama on the host
docker run -d --network=host \
  -v open-webui-data:/app/backend/data \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

**Minimum:** 1 GB RAM for the UI; 2 GB+ if RAG is enabled. Disk scales with uploaded documents.

**Integration tip:** the `/ollama/api/chat` proxy and the OpenAI-compatible `/v1` endpoint let you embed Open WebUI as a managed chat surface while your application code talks to Ollama directly. Use Open WebUI for humans, your own client for production agents.
