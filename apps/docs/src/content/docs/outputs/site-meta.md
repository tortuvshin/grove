---
title: Site metadata
description: webmanifest, security.txt, humans.txt — small but important artifacts that round out a public site.
---

Beyond SEO and feeds, Grove spaces can ship four small-but-important artifacts: a PWA webmanifest, an `security.txt`, a `humans.txt`, and (optionally) a `theme-color` meta block. None of these ship today; all are tracked under the "Planned" column below. This page documents the planned shape so consumers can implement them.

## `manifest.webmanifest`

A [W3C Recommendation](https://www.w3.org/TR/manifest/) that gives browsers the install hint, theme color, and icon set for "Add to Home Screen" behavior on iOS Safari (since iOS 17) and Chromium-based browsers. For static-only sites (no service worker) the manifest alone enables installability.

```json
{
  "name": "Grove — Directory of AI Agent Frameworks",
  "short_name": "Grove",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#08090a",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Linked via `<link rel="manifest" href="/manifest.webmanifest">`. Icons are generated at build time using `@resvg/resvg-js` (matching the OG-image generator).

Reference implementation: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/frameworks/astro).

## `/.well-known/security.txt`

[RFC 9116](https://datatracker.ietf.org/doc/html/rfc9116) — A file at `/.well-known/security.txt` that tells security researchers where to report vulnerabilities.

```
Contact: mailto:security@example.com
Expires: 2027-12-31T18:00:00Z
Preferred-Languages: en
Canonical: https://example.com/.well-known/security.txt
```

Required fields: `Contact`, `Expires`. Optional: `Canonical`, `Policy`, `Encryption`, `Acknowledgments`, `Hiring`, `Preferred-Languages`. Must be served as `text/plain; charset=utf-8` over HTTPS. Expiry must be >30 days from build time (validator enforces this).

Grove will read `site.security: { contact, expires, policy, encryption, preferredLanguages, canonical }` from `grove.config.ts` and emit the file.

## `/humans.txt`

[humanstxt.org](https://humanstxt.org/humanstxt/spec) — A community convention since 2009. Three sections, plain text at the site root:

```
/* TEAM */
  Lead curator: Your Name — site:example.com — twitter:@handle
  Editor: ...

/* SITE */
  Last update: 2026/08/14
  Standards: HTML5, CSS3, Open Graph
  Components: Astro 5, @grove-dev/astro 0.5
  Software: https://github.com/tortuvshin/grove

/* THANKS */
  Anthropic — for sponsoring llms.txt research
  ...
```

Linked via `<link type="text/plain" rel="author" href="/humans.txt">` and a footer mark.

## `theme-color` (already shipped)

Every page already includes a `<meta name="theme-color" content="...">` driven by `theme.primaryColor` from `grove.config.ts`. iOS Safari and Android Chrome use this to color the address bar.

## What ships today

| Output | Status |
|---|---|
| `theme-color` meta | **Shipped** |
| Inline SVG favicon | **Shipped** |
| `manifest.webmanifest` | Planned |
| `/.well-known/security.txt` | Planned |
| `/humans.txt` | Planned |

## Related

- [Overview of all outputs](/outputs/overview/)
- [LLM-oriented outputs](/outputs/llm/)
- [SEO & social](/outputs/seo/)