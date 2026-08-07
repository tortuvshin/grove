Ollama is a single-binary tool that pulls, runs, and serves open-weights language models on a developer laptop. It exposes a small REST API and a familiar `ollama run <model>` CLI, so swapping between Llama, Mistral, Qwen, Phi, Gemma, or a custom GGUF takes one command.

## Why it matters

- **One install, many models.** `ollama pull`, `ollama run`, `ollama serve` cover the loop. No separate venv per model, no manual tokenizer setup.
- **Same API as OpenAI-compatible endpoints.** Anything that speaks `http://localhost:11434/v1/chat/completions` works — LangChain, LlamaIndex, Open WebUI, your own scripts.
- **GPU and CPU paths both supported.** Metal on macOS, CUDA on Linux, ROCm on AMD, plus a CPU fallback for small models. The same `Ollama` binary picks the right backend at startup.
- **Model library stays current.** New releases land within hours of upstream — try `ollama run llama3.2:3b` or `ollama run qwen2.5-coder:7b` without leaving the terminal.

## How it works

Under the hood Ollama bundles a curated set of GGUF quantizations and runs them through `llama.cpp`. The CLI wraps a Go daemon that listens on `127.0.0.1:11434` and serves the same `/api/chat`, `/api/generate`, `/api/embed`, and `/api/show` endpoints that production stacks call into. Models are stored in `~/.ollama/models` and deduplicated by blob hash, so pulling a 70B model after a 7B one only fetches the new layers.

The `/api/chat` endpoint accepts OpenAI's request shape (`messages`, `temperature`, `tools`, `stream`) and returns either SSE chunks or a single JSON document. This is what makes Ollama a drop-in target for any framework that already speaks OpenAI — including the rest of this directory.

## Caveats

- **Large models still need capable hardware.** A 70B Q4 quant wants ~40 GB of unified memory; on a 16 GB Mac the same model will spill to disk and run very slowly.
- **First-pull latency is large.** A 30 GB model takes minutes to download. The Ollama library pages exist because users hit this on day one.
- **No hosted fallback.** Ollama is local-only; if the laptop sleeps, requests stall. For a managed backend, the same model format is served by `llama.cpp` HTTP servers and by cloud providers that proxy the Ollama API.
- **Quantization trade-offs.** Q4 is the default for a reason — lower-quants lose coherence on long-context tasks. Test on your actual prompt distribution before committing.

## Deployment notes

```bash
# Install (macOS, Linux, Windows)
curl -fsSL https://ollama.com/install.sh | sh

# Pull and run
ollama pull llama3.2:3b
ollama run llama3.2:3b

# Serve as an OpenAI-compatible API
ollama serve  # listens on 127.0.0.1:11434
```

**Minimum hardware:** Apple Silicon with 8 GB unified memory for a 3B Q4; 16 GB for 7B; 32+ GB for 13B–30B; 64 GB or an M2 Ultra for 70B. Linux with an NVIDIA GPU and `>= 8 GB` VRAM is enough for a 7B Q4.

**Integration tip:** when wiring Ollama into a web UI (Open WebUI, AnythingLLM, a custom Astro app), point the base URL at `http://localhost:11434/v1` and use any non-empty string as the API key. Ollama ignores the key but most clients require one.
