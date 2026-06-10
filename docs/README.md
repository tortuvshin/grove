# Grove docs site

The documentation site for [Grove](https://github.com/tortuvshin/grove), built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build) and themed with [`lucode-starlight`](https://lucas-labs.github.io/lucode-starlight-theme/).

This site is **not** a published npm package — it's the source for <https://grove.tortuvshin.dev> (or wherever the project points it next). It lives in the workspace so that doc changes ship in the same PR as the code they describe.

## Develop

```bash
# From the repo root:
pnpm install
pnpm dev:docs
```

The site is served at <http://localhost:4321> by default. Edits in `src/content/docs/` hot-reload.

## Build

```bash
pnpm --filter @grove-dev/docs build
```

The static site lands in `docs/dist/`. Hosting is intentionally simple — the site is fully static, so it deploys cleanly to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

## Layout

```txt
docs/
├── astro.config.mjs        # Starlight config (sidebar, plugins, integrations)
├── src/
│   ├── assets/             # images, logos
│   ├── components/         # custom components used inside MDX pages
│   ├── content/
│   │   └── docs/           # the actual docs (each .md / .mdx file is a route)
│   ├── layouts/            # custom layouts (wrapping Starlight's)
│   ├── styles/             # global.css + theme overrides
│   └── content.config.ts   # Starlight content collection config
├── public/                 # static files served at the site root
├── ARCHITECTURE.md         # in-repo architecture overview
├── RELEASING.md            # how a release happens
├── ROADMAP.md              # what's planned
├── SUPPORT.md              # where to ask questions
├── VISION.md               # why Grove exists
└── README.md               # this file
```

The top-level files (`ARCHITECTURE.md`, `RELEASING.md`, etc.) are imported as content from `src/content/docs/` via Starlight's `autogenerate` / manual `glob` loader, so they live in two places at once: the repo root for discoverability on GitHub, and the docs site for the in-app reading experience.

## Editing a page

1. Edit the `.md` / `.mdx` file under `src/content/docs/`.
2. Save. The dev server hot-reloads.
3. If you added a brand-new file, also add it to the sidebar in `astro.config.mjs` (the `sidebar` array).

## Adding a new top-level doc

For long-form documents that should also live at the repo root (e.g. a new `CONTRIBUTING.md`–style file), add the file at the repo root **and** an `import` entry in `src/content/docs/<route>.md`:

```md
---
title: My new doc
---

import Content from '../../../../MY-NEW-DOC.md';

<Content />
```

This way the doc shows up on the site *and* on GitHub.

## Deploying

We don't have a single canonical deploy pipeline yet — see [`../roadmap.md`](../roadmap.md) for the backlog entry. In the meantime, the project is happy with any of:

- **GitHub Pages** — push `docs/dist/` to a `gh-pages` branch (or use `actions/deploy-pages`).
- **Netlify / Vercel / Cloudflare Pages** — point at `docs/`, set the build command to `pnpm build`, the publish directory to `docs/dist`.

## Conventions

- MDX is fine; you can import components from `lucode-starlight` and `@grove-dev/astro`.
- Code fences should declare a language. Use `bash` for shell, `ts` for TypeScript, `astro` for Astro component snippets.
- Internal links use **relative paths** (`./architecture.md`), not absolute GitHub URLs. Starlight rewrites them correctly at build time.
- Keep page titles short and noun-phrase-y — they show up in the sidebar and the page `<title>`.

## License

The docs site is part of the Grove monorepo and is released under the [MIT License](../LICENSE).
