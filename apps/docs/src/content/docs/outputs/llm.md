---
title: LLM-oriented outputs
description: llms.txt, llms-full.txt, ai.txt, JSON Feed, MCP manifest — how Grove exposes your content to AI assistants and crawlers.
---

Grove ships LLM-oriented outputs to make your content first-class for AI assistants, agents, and crawlers. The two that ship today are `llms.txt` (the standard introduced by Jeremy Howard / Answer.AI) and `llms-full.txt` (its per-record mirror). Several additional outputs are planned; this page describes what exists and what's coming.

## `llms.txt`

The site-level index of every record, capped under ~10 KB so it fits in a model context window. Spec: <https://llmstxt.org>.

```markdown
# <Site name>

> One-paragraph summary of the site.

## Optional

- [Project A](https://example.com/a/): short description.
- [Project B](https://example.com/b/): short description.

## Notes

- Optional explanations, conventions, citation style.
```

Grove emits the H1 site name from `site.title`, the blockquote summary from `site.description`, and the record list grouped under `## Optional` per spec convention.

## `llms-full.txt`

Per-record sections, one per record, with the full Markdown body included. Used by AI agents that want the deep context.

```markdown
# <Site name>

> Site summary.

## <Record 1 title>

<Record 1 body in Markdown>

Source: https://example.com/record-1/
Author: ...
Updated: ...

## <Record 2 title>
...
```

For very large sites, the file is capped at 50 records with a `# Truncated — see llms-full.txt` footer. The two-tier design follows the [AnswerDotAI/llms-txt](https://github.com/AnswerDotAI/llms-txt) reference implementation.

## `.md` shims

For each record page, Grove emits a `.md` shim at `/<routeSlug>/<recordSlug>.md`. The shim is the Markdown body with frontmatter, suitable for direct ingestion by agents that don't fetch HTML.

## `ai.txt` (planned)

[Cloudflare's Content Signals Policy](https://blog.cloudflare.com/content-signals-policy/) (Sept 24, 2025) and the IETF `draft-car-ai-txt-wellknown-00` propose a dedicated file for AI-crawler policy. Planned artifact:

```text
Site-Name: Grove — Directory of AI Agent Frameworks
Site-URL: https://example.com
Description: A curated directory of production-grade agent frameworks.
Contact: mailto:hello@example.com
Training: deny
Scraping: allow
Indexing: allow
```

The companion `/.well-known/ai.json` mirrors the same fields in JSON. Cloudflare-managed customers get the same signals injected into their existing `robots.txt`:

```
User-agent: *
Content-Signal: search=yes, ai-train=no, ai-input=yes
```

## JSON Feed (planned)

[JSON Feed v1.1](https://www.jsonfeed.org/version/1.1/) is a stable, machine-friendly alternative to RSS/Atom. For each blueprint and curated collection, Grove will emit `feed.json` with `application/feed+json` autodiscovery.

## MCP manifest (planned)

[Model Context Protocol](https://modelcontextprotocol.io) describes a JSON-RPC protocol for AI-tool integration. A static site can't serve a full MCP server, but it can publish a discovery manifest at `/.well-known/mcp.json` declaring which `resources` and `tools` are exposed:

```json
{
  "name": "example.com",
  "version": "1.0.0",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": { "listChanged": false },
    "tools": { "listChanged": false }
  },
  "serverInfo": { "name": "example.com", "version": "1.0.0" }
}
```

Full MCP interaction requires a runtime; the manifest is purely declarative.

## Structured JSON catalog (planned)

Versioned JSON dumps at `public/api/v1/catalog.json` and per-record `public/api/v1/records/<slug>.json`, following the `crates.io` / npm-registry precedent. ETag and `Last-Modified` headers enable cheap conditional GETs for AI crawlers doing broad scans.

## Related

- [Overview of all outputs](/outputs/overview/)
- [SEO & social](/outputs/seo/)
- [llms.txt spec](https://llmstxt.org)
- [JSON Feed v1.1](https://www.jsonfeed.org/version/1.1/)