---
title: "Walkthrough: curate a collection"
description: Turn a browse filter into a named, ranked, curator-owned page that lives at /collections/<slug>/.
---

By the end of this walkthrough you will have a curated page at `/collections/<slug>/` that lists every record matching a query you chose. This is the most common curator action: turning "I noticed these belong together" into a permanent page.

Assumes the dev server is running (`pnpm dev`) and you've completed [Walkthrough: add your first record](/guides/walkthrough-add-record/).

## 1. Find the filter you want to promote

Open your site in the browser and use the browse filters on `/browse`. Combine them until the result is the list you want to keep. The filters compose: pick a category, a stack, a platform — any combination.

The filter expression ends up in the URL:

```text
http://localhost:4321/browse?stack=typescript&category=ai-tools
```

**What you should see:** a list of records matching the combined filters. This is what your collection will become.

## 2. Promote the filter to a collection

In another terminal (the dev server can keep running):

```bash
pnpm exec grove collection promote \
  --from '/browse?stack=typescript&category=ai-tools' \
  --slug typescript-ai-tools \
  --title 'TypeScript AI tools'
```

The command:

- Parses `--from` with `URLSearchParams` (handles `&`, `=`, `+`, percent-encoding).
- Writes `data/collections/typescript-ai-tools.yml` with `kind: curated`, a `query` block derived from the URL params, and `ranking.preset: 'quality'`.
- Creates the directory if it didn't exist.

**What you should see:** the new file appears in your editor with a populated `query` block.

## 3. Add editorial metadata

Open `data/collections/typescript-ai-tools.yml` and add the curator-owned fields:

```yaml
slug: typescript-ai-tools
kind: curated
title: TypeScript AI tools
description: |
  TypeScript-first agent frameworks, model servers, and AI tooling
  we'd reach for today. Hand-curated and reviewed quarterly.
query:
  stacks: [typescript]
  categories: [ai-tools, agent-frameworks]
  excludeStatuses: [archived]
ranking:
  preset: quality
seo:
  title: TypeScript AI tools
  description: TypeScript-first AI tooling we'd reach for today.
  index: true
editorial:
  reviewer: maintainer-name
  reviewedAt: "2026-04-01"
  notes: Re-curated for the 2026 launch.
```

**What you should see:** the dev server hot-reloads the collection page at `/collections/typescript-ai-tools/` with the new description, the editorial reviewer block, and the new ranking.

## 4. Validate the collection

```bash
pnpm exec grove check
```

**What you should see:** zero errors. The collection's query is validated against the canonical facet ids; typos in `stacks` or `categories` fail immediately.

## 5. See the curated page

Visit `http://localhost:4321/collections/typescript-ai-tools/`. The page shows:

- The title and description.
- The ranked list of records.
- The "Last reviewed" badge from `editorial.reviewedAt`.
- The per-record detail links.

Visit `http://localhost:4321/collections/` to see the index of all collections — your new one appears here too.

## 6. Commit and open the PR

```bash
git add data/collections/typescript-ai-tools.yml
git commit -m "Curate typescript-ai-tools collection"
git push
```

**What you should see:** the CI workflow runs `grove check`. After merge, the collection appears on the live site.

## Next steps

- [Curate with decisions →](/concepts/decisions/) — override visibility for individual records.
- [Walkthrough: sync GitHub metadata →](/guides/walkthrough-sync-github/) — enrich every record with live data.