---
title: Images and assets
description: Drop static assets under public/. Logos, OG images, and stack icons all live there.
---

Static assets go under `public/`. Anything in `public/` is served as-is from the site root without going through the Astro build.

## Default layout

```
public/
├── favicon.svg                 # referenced via site.favicon in grove.config.ts
├── logo.svg                    # referenced via site.logo in grove.config.ts
├── og-image.svg                # generated brand card — edit to take ownership
├── robots.txt                  # generated — edit to take ownership
├── llms.txt                    # generated; always regenerated, edit the config instead
├── llms-full.txt               # generated; always regenerated, edit the config instead
└── icons/
    ├── .grove-icons.json       # synced; do not edit
    ├── stacks/                 # language / framework marks
    │   ├── typescript.svg
    │   ├── python.svg
    │   └── rust.svg
    └── platforms/              # ios.svg, android.svg, web.svg, …
```

All of these are written by `prepareDirectory`, which runs on every `astro dev`, `astro build`, and `grove check` (`packages/core/src/prepare.ts`) — not just `grove check`. What happens to your edits on the next build differs by file:

- **`robots.txt` and `og-image.svg`** carry an ownership-marker comment (`# grove-generated: edit this file to take ownership` / `<!-- grove-generated: edit this file to take ownership -->`). Grove only (re)writes the file while that marker is still present. Edit the file yourself — the marker goes away with your edit — and Grove leaves it alone on every future build (`packages/core/src/site-artifacts.ts`).
- **`llms.txt` and `llms-full.txt`** have no such marker — they're overwritten unconditionally on every build. Change the inputs (`site`, `readme`, your records) instead of the files.

## Stack and platform icons

Grove ships a vendored icon set and syncs it into `public/icons/` on every build, so the `Icon` component and the files it points at never drift apart. The filename is the taxonomy `id`, lowercased and dash-cased:

```yaml
# data/taxonomy/stacks.yml
- id: typescript
  name: TypeScript
```

```bash
public/icons/stacks/typescript.svg
```

A handful of ids resolve through built-in aliases — `ios`, `macos`, `swiftui`, and `objective-c` all render `stacks/apple.svg`; `kmp` renders `stacks/kotlin.svg`.

### Monochrome vs colour

Each packaged icon is classified `mono` or `color`:

| Kind | Examples | How it renders |
|---|---|---|
| `color` | React, Flutter, Python, TypeScript, Android, Docker, Go, Linux, Django | An `<img>` in the brand's own palette, with an initials chip as the error fallback |
| `mono` | Apple, Rust, Tauri, Solidity, Deno, and every concept glyph (`web`, `desktop`, `llm`) | A CSS-masked `<span>` painted from `--grove-foreground` — solid black on light, solid white on dark |

**`color` is the default.** A brand keeps its own palette even when contrast is imperfect; Grove does not trade brand colour for legibility.

`mono` is reserved for marks that have no colour to lose. Apple, Rust, Tauri and Deno each publish one flat shape and present it black on light backgrounds and white on dark ones, so masking is the *faithful* rendering rather than a fallback — and it needs one file instead of a `-light`/`-dark` pair.

Masking is what makes that possible at all: an SVG loaded through `<img src>` is a separate document that page CSS cannot reach, so `currentColor` inside one never resolves against the theme. A mask flips the relationship — the file supplies the shape, the page supplies the colour. Override `--grove-icon-mono` on an ancestor if you want a mark tinted rather than full-contrast.

### Adding your own icon

Drop a square SVG at `public/icons/stacks/<id>.svg`. Grove never overwrites a file it did not write, and any name it does not recognise renders as an `<img>` with the initials fallback — exactly as before.

For a mark with no colour of its own, author it with `fill="currentColor"` and pass `kind="mono"`:

```astro
<Icon name="my-tool" category="stack" kind="mono" size={18} />
```

### Restoring the packaged set

```bash
grove icons sync           # write anything missing or unmodified
grove icons sync --force   # discard local edits, match the packaged set exactly
grove icons sync --check   # exit 1 if the set has drifted (for CI)
```

Ownership is tracked by sha256 in `public/icons/.grove-icons.json`. Edit an icon and Grove leaves it alone, reporting it during the build.

The set is vendored via `@iconify-json/simple-icons` and `@iconify-json/logos` (both CC0-1.0), pinned per-icon in `scripts/icons.config.mjs`. Brand marks remain the property of their respective owners.

## Adding custom directories

`public/` is yours. Add subdirectories for project-specific assets:

```
public/
├── fonts/                      # self-hosted webfonts (rare)
├── images/                     # hero images, illustrations
└── downloads/                  # PDFs, release artifacts
```

Reference them as absolute paths:

```astro
<img src="/images/hero.png" alt="...">
```

## `src/assets/` vs `public/`

| Source | Build-time optimized | Served as-is |
|---|---|---|
| `src/assets/` | ✓ (via `astro:assets`) | — |
| `public/` | — | ✓ |

Use `src/assets/` for hero images and inline graphics processed by Astro's `<Image>`. Use `public/` for brand files, downloadable artifacts, and stack icons (which are looked up by filename at render time).

Stack icons in particular have to stay in `public/`: they are referenced by a URL computed at render time, and a masked icon is loaded by CSS rather than by an `import`, so neither can go through Astro's asset pipeline.

## What NOT to put in `public/`

- Records — they're YAML under `data/records/`.
- Markdown content — long-form prose goes under `content/pages/`.
- Hand-authored `llms.txt`/`llms-full.txt` — always overwritten on the next build; there's no ownership marker to remove.
- Synced files — `public/icons/.grove-icons.json` is written by the build; it records which icons Grove owns.

## Related

- [Branding](/customize/branding/) — logo, favicon, OG image
- [Theme](/customize/theme/) — colour tokens
- [Astro assets reference](https://docs.astro.build/en/guides/assets/) — `<Image>`, `getImage()`