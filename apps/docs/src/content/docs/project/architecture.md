---
title: Incremental build
description: Architectural decision record — replacing the always-full `prepareDirectory` pipeline with per-entry caching.
---

> Status: **proposed**. This page documents the design for incremental build support. The current pipeline (full re-run on every call) is the largest latent performance cliff in Grove.

## Problem

`prepareDirectory` (`packages/core/src/prepare.ts:108`) chains `loadConfig` → `generate` → `buildSitemap` → `buildLlmsFiles` → `buildSiteArtifacts`. Every invocation re-parses every YAML file, regenerates every JSON, and re-emits every public artifact. For a directory with thousands of records, this is acceptable for production builds but unacceptable for `astro dev` cycles where content changes are frequent.

## Goals

1. **Per-file change detection** — editing one record triggers re-processing of that record plus downstream artifacts that depend on it (sitemap entry, llms section, related records).
2. **No correctness regression** — the visible output must match a full re-run.
3. **Backward-compatible CLI** — existing `grove check` behavior is unchanged; incremental is opt-in.
4. **Watch-mode for dev** — `astro dev` should hot-reload content without restarting the server.

## Design

### Cache layer

A `.grove/cache/manifest.json` records per-file hashes and pipeline-stage outputs:

```json
{
  "version": 1,
  "schemaVersion": "0.5.0-next.2",
  "files": {
    "data/records/ollama.yml": {
      "hash": "sha256:...",
      "mtime": 1723641600000,
      "stages": {
        "parse": { "ok": true, "output": "IndexRecord" },
        "generate": { "ok": true, "output": "data/generated/records.json#ollama" },
        "sitemap": { "ok": true, "output": "public/sitemap.xml#ollama" },
        "llms": { "ok": true, "output": "public/llms-full.txt#ollama" }
      }
    }
  }
}
```

### Trigger integration

The Astro integration hooks (`astro:config:setup`, `astro:server:setup`) call `prepareDirectory` only when the manifest is missing or invalid. Subsequent calls invoke `refreshContent({ loaders })` (Astro 5) on file-watcher events.

### Vite plugin

A dedicated Vite plugin (`grove-content-watcher`) is injected into the Astro config:

```js
{
  name: "grove-content-watcher",
  configureServer(server) {
    server.watcher.add([
      "data/**/*.yml",
      "data/**/*.yaml",
      "content/**/*.md",
      "data/decisions.yml",
      "data/overrides.yml",
      "grove.config.ts"
    ]);
  },
  async handleHotUpdate(ctx) {
    if (matchesContent(ctx.file)) {
      await rebuildIncrementally(ctx.file);
      await ctx.server.reloadModule();
    }
  },
  apply: "serve"
}
```

The plugin is `apply: 'serve'` so it never runs in production builds.

## Trade-offs

| Pro | Con |
|---|---|
| Sub-second dev cycles for large catalogs | Cache invalidation is hard to get right |
| Watch mode without restarting dev server | First build is no faster |
| Opt-in via flag | New config knob for users to learn |

## Alternative considered

**Vite HMR alone** — let `data/generated/records.json` be a JSON module that Astro watches. Re-runs of `prepareDirectory` are still needed for sitemap/llms, so this doesn't address the root issue.

**Write-only outputs** — only regenerate the outputs that changed. Doesn't solve the per-record invalidation problem.

## Roll-out

1. Land cache manifest behind `--incremental` flag in core.
2. Wire `refreshContent` in the Astro integration.
3. Add the Vite plugin.
4. Make `--incremental` the default in `astro dev`.
5. Deprecate `--no-incremental`.

## Related

- [Astro integration hooks](https://docs.astro.build/en/reference/integrations-reference/)
- [Vite plugin API](https://vite.dev/guide/api-plugin)
- [Plugin author guide](/reference/plugin-author-guide/)