---
title: Add your first project
description: Write a YAML record, save it, and see it render in your local directory.
---

Create `data/records/my-project.yml`:

```yaml
kind: project
slug: my-project
name: My Project
description: A short description of what the project does and who it's for.
website: https://example.com
repository: https://github.com/example/project

categories:
  - developer-tools

tags:
  - open-source
  - typescript
```

Save the file. The dev server picks it up immediately and the project appears in your local directory at `http://localhost:4321/projects/my-project/`.

## Required fields

| Field | Required | What it is |
|---|---|---|
| `kind` | yes | Must be `project` for the `project-directory` blueprint |
| `slug` | yes | The record's unique id. Used in URLs and cross-references. |
| `name` | yes | Human-readable name. Shown in cards and headings. |
| `description` | yes | One-sentence summary. Shown in lists and search snippets. |
| `category` | recommended | One of your taxonomy categories. Defaults to `uncategorized`. |
| `tags` | no | Free-form labels for filtering. |
| `links` | no | URLs to website, GitHub, docs, source. |
| `repoUrl` | no | Canonical GitHub URL. Powers `grove sync github`. |
| `stack` / `stacks` | no | Stack chips on the card. |
| `platforms` | no | Platform filter chips. |
| `bestFor` / `whyListed` / `caveats` | no | Curator notes — surfaced on the detail page. |

The full schema is in [Project record reference](/reference/record-schema/).

## Validation

Run validation at any time:

```bash
grove validate
```

You should see `Validation passed.` If a field is wrong, the error points to the file and field name. Fix and re-run.

Validation also runs automatically on every pull request through the `.github/workflows/validate-data.yml` workflow.

## Publishing

When you're happy with the record:

```bash
git add data/records/my-project.yml
git commit -m "Add My Project"
git push
```

Open a pull request. Validation runs in CI. A maintainer reviews and merges. Grove rebuilds the site and deploys.

## Next steps

- **[Deploy your site →](/getting-started/deploy/)** — push to GitHub and ship it.
- **[Configure your space →](/build/configure/)** — branding, theme, taxonomy.