# Grove docs site

The documentation site for [Grove](https://github.com/tortuvshin/grove), built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build) and themed with [`@grove-dev/starlight`](https://www.npmjs.com/package/@grove-dev/starlight).

This site is **not** a published npm package — it's the source for <https://grove.dev.mn>. It lives in the workspace so that doc changes ship in the same PR as the code they describe.

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

The static site lands in `apps/docs/dist/`. Hosting is intentionally simple — the site is fully static, so it deploys cleanly to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

## Layout

```txt
apps/docs/
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
├── MILESTONES.md           # historical V0 milestone log
├── PRODUCT.md              # full product reference
├── RELEASING.md            # operational release doc
├── SUPPORT.md              # where to ask questions
├── vision.md               # why Grove exists (historical)
└── README.md               # this file
```

The canonical source for every page is `src/content/docs/`. The
top-level `.md` files in this directory are mirrors maintained for
GitHub discoverability; their content matches the corresponding
docs-site pages but is not auto-imported.

## Editing a page

1. Edit the `.md` / `.mdx` file under `src/content/docs/`.
2. Save. The dev server hot-reloads.
3. If you added a brand-new file, also add it to the sidebar in
   `astro.config.mjs` (the `sidebar` array).
4. Run `pnpm docs:check` to verify every sidebar slug resolves to a
   real file under `src/content/docs/`.

## Sidebar lint

The sidebar in `apps/docs/astro.config.mjs` is the only navigation
source. `scripts/check-starlight-sidebar.mjs` (exposed as
`pnpm docs:check`) verifies every `slug:` resolves to a real
`.md` / `.mdx` file. CI runs it on every PR that touches
`apps/docs/**`.

## Deploying

The site is fully static and deploys to any static host. The
canonical host is `grove.dev.mn`. The `wrangler.toml` in this
directory targets Cloudflare Pages; alternative hosts (Netlify,
Vercel, GitHub Pages) work by pointing at `apps/docs/` with the
build command `pnpm build` and the publish directory
`apps/docs/dist`.

## Conventions

- MDX is fine; you can import components from `@grove-dev/starlight`
  and `@grove-dev/astro`.
- Code fences should declare a language. Use `bash` for shell,
  `ts` for TypeScript, `astro` for Astro component snippets,
  `yaml` for record / config YAML.
- Internal links use **relative paths** (`./architecture.md`),
  not absolute GitHub URLs. Starlight rewrites them correctly at
  build time.
- Keep page titles short and noun-phrase-y — they show up in the
  sidebar and the page `<title>`.

## License

The docs site is part of the Grove monorepo and is released under
the [MIT License](../../LICENSE).
