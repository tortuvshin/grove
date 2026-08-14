---
title: Add your first project
description: Write a YAML record, save it, and see it render in your local directory.
---

Create `data/records/my-project.yml`. The filename (minus `.yml`) is the
canonical slug and appears in URLs.

```yaml
kind: project
name: My Project
slug: my-project
description: A short description of what the project does and who it is for.
category: developer-tools
tags: [open-source, typescript]
repoUrl: https://github.com/example/project
links:
  website: https://example.com
  github: https://github.com/example/project
bestFor: [Team workflow, Quick start]
whyListed: [Active maintenance, Clean API]
caveats: []
visibility: keep
```

Save the file. The dev server picks it up immediately and the project
appears in your local directory at
`http://localhost:4321/projects/my-project/`.

## Required fields

For the `project-directory` blueprint (`kind: project`):

| Field          | Required | What it is |
| -------------- | -------- | ---------- |
| `kind`         | yes      | Must be `project` for the `project-directory` blueprint. |
| `name`         | yes      | Human-readable name. Shown in cards and headings. |
| `slug`         | yes      | The record's unique id. The filename is canonical; the `slug` field must match. |
| `description`  | yes      | One-sentence summary. Shown in lists and search snippets. |
| `category`     | optional | One of your taxonomy categories. Defaults to `uncategorized`. |
| `tags`         | optional | Free-form labels for filtering. |
| `repoUrl`      | optional | Canonical GitHub URL. Powers `grove sync github`. |
| `links`        | optional | URLs to website, GitHub, docs, source. |
| `stack` / `stacks` | optional | Stack chips on the card. |
| `platforms`    | optional | Platform filter chips. |
| `bestFor` / `whyListed` / `caveats` | optional | Curator notes — surfaced on the detail page. |
| `visibility`   | optional | `highlight` / `keep` / `needs_review` / `hide` / `remove` / `historical`. Defaults to `keep`. |

The full schema is in [Project record reference](/reference/record-schema/).

## Validation

Run the full pipeline at any time:

```bash
pnpm exec grove check
```

You should see `[grove] 1 records prepared; sitemap and llms files
updated.` and an `astro check` summary. If a field is wrong, the
error points to the file and field name. Fix and re-run.

`grove check` is the only command you need for day-to-day validation
— it bundles `validate`, generation, sitemap, llms, robots, og-image,
and `astro check` into a single invocation.

Validation also runs automatically on every pull request through the
`.github/workflows/ci.yml` workflow (which calls `grove check`).

## Publishing

When you're happy with the record:

```bash
git add data/records/my-project.yml
git commit -m "Add My Project"
git push
```

Open a pull request. Validation runs in CI. A maintainer reviews and
merges. Grove rebuilds the site and deploys.

## Next steps

- **[Deploy your site →](/getting-started/deploy/)** — push to GitHub
  and ship it.
- **[Configure your space →](/getting-started/configure/)** — branding, theme,
  taxonomy.