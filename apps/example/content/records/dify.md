Dify is an open-source platform for building production LLM applications. The name is a riff on "Define + Modify" — the product is built around a visual workflow editor that turns prompt chains, retrieval pipelines, and tool calls into a node graph, plus an agent runtime that hosts the resulting application as an API and a chat UI.

## Why it matters

- **Visual workflow + version control.** Every node in a Dify app is a typed operation (prompt, retrieval, code, conditional, HTTP). The graph is serialized as YAML and committed alongside the codebase, so changes are reviewable in pull requests.
- **Multiple delivery surfaces from one app.** A Dify workflow can be published as a chat UI, a REST endpoint, an embeddable widget, or a Slack/Discord bot. Same backend, different shells.
- **Retrieval is a first-class concept.** Knowledge bases (file uploads, web crawls, Notion sync) are bound to workflows as retrieval nodes, with chunking strategy and re-rank model selected per use case.
- **Self-host friendly.** The OSS edition is a Docker Compose stack with PostgreSQL, Redis, and a worker queue. The cloud edition adds SSO and observability.

## How it works

Dify's editor is a React-based node graph; each node is backed by a Python worker that calls the configured model. Workflows serialize to YAML and the runtime (a FastAPI service) reads the YAML, instantiates the node graph, and runs requests through it. Agents (Dify's term for LLM-loop workflows) are a sub-type of workflow with a tool registry, memory, and a configurable maximum-iteration cap.

Knowledge bases are chunked (configurable strategy: parent-child, QA, paragraph), embedded via the configured embedding model, and stored in a vector database. Retrieval at runtime goes through a configurable re-ranker (Cohere, BGE, or none) before the prompt is constructed.

## Caveats

- **The OSS edition is feature-stable, not feature-frozen.** Breaking config changes happen on minor versions. Pin a release and read upgrade notes before bumping in production.
- **Custom nodes require a developer-friendly Python runtime.** A "code" node runs a sandboxed Python snippet; an "HTTP" node makes a request. Anything more complex lives in an external service.
- **Observability is shallow out of the box.** The Dify UI shows request logs and token usage; production teams typically export logs to a real observability backend.
- **Vendor lock-in is real but the YAML serialization is portable.** Exporting a workflow to a standalone repo is documented, but the API server and worker queue are Dify-specific.

## Deployment notes

```bash
# Docker Compose
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
```

**Minimum:** 2 CPU, 4 GB RAM for a single-node dev install. 8+ GB for a production install with vector database and a worker queue.

**Integration tip:** run Dify alongside an existing Astro/Grove app and embed the chat widget. The widget script accepts a `data-` configuration for theme tokens, so a custom color palette in `grove.config.ts` carries through.
