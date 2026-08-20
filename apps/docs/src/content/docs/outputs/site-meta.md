---
title: Site metadata
description: The head tags Grove's layout emits on every page, which config field drives each one, and the well-known files you have to add yourself.
---

Grove's `BaseLayout` writes a fixed set of document-level tags. This page is
about those — the per-page SEO and social tags live in
[SEO & social](/outputs/seo/).

## Emitted on every page

```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="generator" content="Astro v5.x" />
    <meta name="theme-color" content="#0a0a0c" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
    <link rel="icon" href="…" />
    <link rel="sitemap" href="/sitemap.xml" />
    <link rel="preconnect" href="https://avatars.githubusercontent.com" crossorigin="anonymous" />
    <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM usage guidance" />
```

A few of these are worth knowing about:

- **`theme-color` is two tags, media-gated, and hardcoded.** `#0a0a0c` for
  dark, `#fafafa` for light. `theme.primaryColor` does **not** change them.
  To use your own, override the layout.
- **The favicon has a generated fallback.** With `site.favicon` set, that
  path is used. Without it, Grove emits an inline SVG data URI — a rounded
  square filled with `theme.primaryColor`, or `#18181b` when that is unset.
  You never get a broken icon, but you also never get your logo by accident.
- **`rel="alternate"` advertises `llms.txt`** so a crawler that reads head
  links finds the machine-readable surface without guessing the path.
- **The preconnect is for GitHub avatars.** Most list and detail pages render
  at least one, so the TLS handshake is paid once per page instead of at
  first card.

Google Analytics is injected here too, but only when
`analytics.googleAnalyticsId` is set in `grove.config.ts`. With it unset, no
script tag is emitted at all.

## Config fields that reach the head

| Field | Where it lands |
|---|---|
| `site.name` | `og:site_name`, JSON-LD `name`, `publisher.name` |
| `site.description` | JSON-LD `description` |
| `site.url` | `<link rel="canonical">`, `og:url`, every JSON-LD `@id` and `url` |
| `site.locale` | `<html lang>`, `og:locale`, JSON-LD `inLanguage` |
| `site.twitter` | `twitter:site` — omitted entirely when unset |
| `site.logo` | JSON-LD `publisher.logo` |
| `site.repoUrl` | JSON-LD `publisher.sameAs` |
| `site.favicon` | `<link rel="icon">` |
| `theme.primaryColor` | the generated favicon's fill, and the `--grove-theme-primary` CSS variables |

## Not emitted

Grove writes none of these. Add them under `public/` if your site needs
them — Astro copies `public/` verbatim, so the file appears at the matching
URL with no configuration.

| File | When you need it |
|---|---|
| `manifest.json` + `<link rel="manifest">` | Installable PWA. Grove emits no manifest and no link tag. |
| `apple-touch-icon` | iOS home-screen icon. No tag is emitted. |
| `<meta name="color-scheme">` | Not emitted; the two media-gated `theme-color` tags cover the common case. |
| `.well-known/security.txt` | Responsible disclosure contact. |
| `humans.txt` | Credits. |
| `feed.xml` / `feed.json` | RSS or JSON Feed. Grove has no feed generator — build one from `data/generated/records.json`. |
| `.well-known/assetlinks.json`, `apple-app-site-association` | Only for app-bound deep links. |

## Files Grove writes but hands over

`public/robots.txt` and `public/og-image.svg` are generated with an
ownership marker on the first line:

| File | Marker |
|---|---|
| `public/robots.txt` | `# grove-generated: edit this file to take ownership` |
| `public/og-image.svg` | `<!-- grove-generated: edit this file to take ownership -->` |

Grove reads the existing file before each rewrite. Once the marker is gone,
it never touches the file again. Delete the whole file and rebuild to get a
fresh generated one back.

Note the marker syntax differs by file type — `#` for `robots.txt`, an XML
comment for the SVG — because each has to be a valid comment in its own
format.

## Related

- [SEO & social](/outputs/seo/) — per-page tags, JSON-LD, sitemap, OG cards.
- [Outputs overview](/outputs/overview/) — every artifact Grove writes.
- [Branding](/customize/branding/) — setting `site.name`, `site.logo`,
  `site.favicon`.
