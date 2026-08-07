Flowise is a drag-and-drop UI for building LLM applications on top of LangChain. Each "node" in the canvas is a LangChain component — a prompt template, a model, a retriever, a chain, a tool — and the edges between them define the data flow. The result exports to a LangChain Python file, an API endpoint, or an embeddable chat widget.

## Why it matters

- **Visual LangChain for the rest of us.** Most LangChain examples start as Python scripts with five imports. Flowise turns the same composition into a canvas that non-developers can edit.
- **Custom nodes are plain TypeScript.** Drop a `Flowise node` folder into the project, implement the `INode` interface, and the new block appears in the editor sidebar.
- **Built-in chat UI and embed widget.** Every flow can be published as a shareable chat endpoint; the same endpoint is embeddable via a `<script>` tag in any site.
- **Local-friendly.** A single Node process plus a SQLite database is the default; no external services required for a personal playground.

## How it works

Flowise's frontend is a React-based node-graph editor. Each node is a TypeScript class that declares its inputs, outputs, and the `init`/`run` lifecycle. The backend (Express) instantiates the graph on a request, calls `run` on each node in topological order, and streams the output back as a JSON or SSE response.

Nodes ship in three flavors: LangChain (model, retriever, prompt template, output parser, chain), Tools (web search, calculator, custom HTTP), and Utilities (text splitter, embeddings cache, conversation summary). The split is close to LangChain's own module structure, so a developer who already knows LangChain can map a Flowise canvas to a Python script one-to-one.

## Caveats

- **The graph IS the application.** Version control is awkward — the JSON-serialized flow is a thousand-line file with node IDs as keys. Production teams typically commit one flow per file and accept the noise.
- **Custom node development is a fork-or-PR choice.** Adding a private node lives in a fork; upstreaming requires a contribution to the Flowise monorepo.
- **Performance is single-process.** Flowise holds the entire graph in memory and runs nodes in the Node event loop. Long-running chains (heavy retrieval) will block other requests on the same instance.
- **LangChain is a moving target.** Flowise pins specific LangChain versions per release; upgrading requires care.

## Deployment notes

```bash
# Local dev
npx flowise start

# Docker
docker run -d --name flowise \
  -p 3000:3000 \
  -v flowise-data:/root/.flowise \
  flowiseai/flowise
```

**Minimum:** 1 CPU, 1 GB RAM for a personal playground. 2–4 CPU and 4+ GB for a multi-user instance with multiple flows running concurrently.

**Integration tip:** Flowise exposes `/api/v1/prediction/<flow-id>` for embedding in a custom front end. The request body matches the Flowise UI's "API" tab exactly, so an Astro form can POST to it without any client-side state.
