---
title: Promote a filter to a collection
description: Use grove collection promote to save a browse URL as curated YAML.
---

The `grove collection promote` command is the fastest path from "I clicked through to a filter URL" to "I have a curated collection page that lays out the same records in editorial form."

## Workflow

1. Visit `https://example.com/projects/` and click through the filters you want. The URL becomes:

   ```text
   https://example.com/projects/?stack=flutter&category=finance
   ```

   The `?` and `&` syntax follows the same shape anywhere in the URL: the path part carries browse state as query parameters.

2. Run the command:

   ```bash
   pnpm exec grove collection promote \
     --from '/projects/?stack=flutter&category=finance' \
     --slug top-finance-flutter \
     --title 'Top Flutter finance apps' \
     --description 'Hand-picked Flutter projects that handle money well.'
   ```

3. The command writes `data/collections/top-finance-flutter.yml`:

   ```yaml
   slug: top-finance-flutter
   kind: curated
   title: Top Flutter finance apps
   description: Hand-picked Flutter projects that handle money well.
   query:
     stacks: [flutter]
     categories: [finance]
     excludeStatuses: [archived]
   ranking:
     preset: quality
   seo:
     index: true
   ```

4. Curators then edit the YAML — adding `editorial.introduction` or `editorial.selectionNote`, tweaking the ranking preset, adding `query.licenses` or `query.minStars`, etc.

## Options

| Flag | Required | Description |
|---|---|---|
| `--from <path>` | yes | Source filter URL or path-with-query-string. Parsed with `URLSearchParams`. |
| `--slug <slug>` | yes | Slug for the new collection. Used in the URL `/collections/<slug>/`. |
| `--title <title>` | no | Title (defaults to humanized slug). |
| `--description <description>` | no | Long description (defaults to "Curated collection built from <from>."). |

## What the parser handles

`--from` is parsed with `URLSearchParams`, not string splitting:

- `&`, `=`, `+`, and percent-encoded characters round-trip correctly.
- A parameter repeated (`?stack=flutter&stack=python`) does **not** become a multi-value array — the parser takes the last value only, matching the prior split-parser's behavior, so `query.stacks` ends up `["python"]`.
- The base URL (host) is irrelevant; the query string is what matters.

The parser only maps three parameters into the collection's `query`: `stack` → `query.stacks`, `category` → `query.categories`, `platform` → `query.platforms` (each wrapped in a single-element array). Anything else in the URL — `tags`, `license`, `q`, a status filter — is silently dropped, not stored anywhere. Add it to the YAML by hand afterward using the real `CollectionQuery` fields (`licenses`, `minStars`, `minForks`, `q`, `kinds`) — there's no catch-all field that captures unrecognized parameters.

## What the command does NOT do

- It does **not** call `grove check` afterward. Run it manually to validate.
- It always overwrites. The collection file is replaced if it already exists — the curator's previous edits are lost, with no merge. **Always** review the new YAML before committing.

## Editing the resulting YAML

The interesting post-write edits:

```yaml
slug: top-finance-flutter
kind: curated
title: Top Flutter finance apps
description: Hand-picked Flutter projects that handle money well.
query:
  stacks: [flutter]
  categories: [finance]
  excludeStatuses: [archived]
  licenses: [mit]
  minStars: 100
ranking:
  preset: quality         # or active, curated, recency, stars
seo:
  title: Top Flutter finance apps
  description: Hand-picked Flutter projects that handle money well.
  index: true
editorial:
  introduction: Flutter apps that pass our finance-app checklist.
  selectionNote: Re-curated for the 2026 launch.
  lastReviewedAt: "2026-04-01"
```

After editing, run `pnpm exec grove check` to validate and `pnpm build` (or wait for CI) to ship.

## Why not skip the command and write YAML by hand

You can. Many curators do, especially when the query is more complicated than three facets, or when there's no browse filter to start from at all. Use `grove collection promote` when you're starting from a filter URL — it's faster and the YAML shape stays consistent with the rest of the site.

## See also

- [Curated collections](/concepts/collections/) — file shape and worked examples.
- [Browse pages](/discovery/browse/) — the URL shape.
- [Lens recipes](/discovery/lens-recipes/) — when to use a lens vs a collection.
