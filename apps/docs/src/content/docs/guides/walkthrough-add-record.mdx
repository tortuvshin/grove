---
title: "Walkthrough: add your first record"
description: An end-to-end 8-minute walkthrough that takes you from an empty directory to your first record rendered on the site.
---

This is the canonical "first 8 minutes" with Grove. By the end you will have a record you can see on the running site. The walkthrough assumes you've installed Node `>=22.12.0` and pnpm `10.12.1`. If not, see [Install the CLI](/getting-started/install-cli/).

## 1. Scaffold a space

```bash
pnpm dlx @grove-dev/cli@latest init my-space
cd my-space
```

**What you should see:** a `my-space/` directory with `data/`, `src/`, `public/`, `grove.config.ts`, and a sample of six records under `data/records/`.

## 2. Start the dev server

```bash
pnpm dev
```

**What you should see:** Astro prints `Local: http://localhost:4321/`. Open that URL — your directory's homepage renders with the six sample records. Edits to `data/records/*.yml` rebuild within a few hundred milliseconds.

## 3. Edit one of the sample records

Open `data/records/ollama.yml` (or any sample). Replace the placeholder fields with your own:

```yaml
kind: project
name: my-project
description: One-line summary of what my-project does.
repoUrl: https://github.com/me/my-project
stacks: [typescript]
licenses: [mit]
```

**What you should see:** the dev server hot-reloads. The detail page at `http://localhost:4321/projects/my-project/` renders with your values.

## 4. Validate the record

```bash
pnpm exec grove check
```

**What you should see:** the validator walks every record against the Zod schema. A clean run ends with `0 errors`. If your record fails, the output names the file, the field, and the expected type.

## 5. See the record on the site

Visit `http://localhost:4321/projects/my-project/`. The detail page should show:

- The record's name, description, and category.
- The "View repository" button (from `repoUrl`).
- Stack and license chips (from `stacks` / `licenses`).
- The auto-generated JSON-LD block in the page source (View → Inspect).

The homepage index also lists the new record alphabetically.

## 6. Commit and open the PR

```bash
git add data/records/my-project.yml content/records/my-project.md
git commit -m "Add my-project"
git push
```

**What you should see:** GitHub Actions runs `grove check` plus `astro build`. If `integrations.github` is enabled, `sync-github.yml` enriches the record with live stars / language / last-pushed data on the next scheduled run. Merge the PR; the site rebuilds.

## Next steps

- [Walkthrough: curate a collection →](/guides/walkthrough-curate-collection/) — turn a filter into a named page.
- [Walkthrough: sync GitHub metadata →](/guides/walkthrough-sync-github/) — enrich every record with live data.