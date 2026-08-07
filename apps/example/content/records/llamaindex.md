# LlamaIndex

LlamaIndex is a data framework for connecting custom data to large language models. The premise: an LLM is only as useful as the context it can pull, and most production applications need that context from a corpus the model never saw at training time. LlamaIndex provides the connectors, parsers, chunking strategies, retrieval modes, and query engines that turn a pile of files into a usable RAG pipeline.

## Why it matters

- **Connectors for almost every source.** Notion, Slack, Discord, GitHub issues, S3 buckets, PDFs, databases, Airtable, and a generic `SimpleDirectoryReader` for "everything in this folder".
- **Ingestion is a first-class concern.** A `VectorStoreIndex` is one line, but the production path — `SentenceSplitter`, `MetadataFilters`, `IngestionPipeline` with caching and dedup — is what `llama-index-core` actually optimizes for.
- **Retrieval is configurable per query.** A `RetrieverQueryEngine` lets you mix vector similarity, keyword (BM25), and reranking in the same query, with per-source weights set at query time.
- **Agentic patterns are native.** `FunctionAgent`, `ReActAgent`, and the `Workflow` API turn a multi-step RAG query into a typed graph with retries, observability, and human-in-the-loop checkpoints.

## How it works

LlamaIndex organizes the pipeline as a sequence of `Node` objects — typed chunks of the source corpus with attached metadata. An `IngestionPipeline` reads files via a `Reader`, splits them via a `NodeParser` (default: sentence-aware), embeds each node via the configured embedding model, and stores the result in a `VectorStore` (in-memory, Chroma, Qdrant, Pinecone, Weaviate, pgvector, etc.). A `QueryEngine` takes a user question, retrieves the top-k nodes, optionally reranks them, and asks the LLM to synthesize an answer.

The agent stack layers on top: a `FunctionAgent` is given a set of tools (each one typically a small RAG query over a different index) and decides which to call. The `Workflow` API gives a Pythonic way to define a typed event-driven graph when the query is more than a single retrieval call.

## Caveats

- **The surface is large.** A `from llama_index import ...` statement can pull in five different subsystems (core, embeddings, vector stores, agents, instrumentation). Pin a version per project.
- **Chunking strategy is the silent killer.** A 500-page PDF chunked paragraph-by-paragraph and a 500-page PDF chunked parent-child behave very differently. Benchmark on your real data, not on a one-doc toy example.
- **Reranking is not free.** Cross-encoder rerankers add a second model call and 100–500 ms per query. A/B test on whether the quality lift justifies the cost.
- **Observability is opt-in.** LlamaIndex's `Instrumentation` system emits spans to OpenTelemetry, but the wiring is a developer choice. Without it, debugging a misbehaving pipeline means `print` statements.

## Deployment notes

```bash
pip install llama-index
# Add vector store + embeddings as needed
pip install llama-index-vector-stores-chroma llama-index-embeddings-ollama
```

```python
from llama_index.core import (
    VectorStoreIndex, SimpleDirectoryReader, Settings,
)
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

Settings.embed_model = OllamaEmbedding("nomic-embed-text")
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents, vector_store=ChromaVectorStore(...))
engine = index.as_query_engine()
print(engine.query("What is the deploy target?"))
```

**Minimum:** Python 3.10+, an embedding model (local via Ollama, or an API), and a vector store. The default in-memory store is fine for development; production should pick a real backend before the index crosses ~100k nodes.
