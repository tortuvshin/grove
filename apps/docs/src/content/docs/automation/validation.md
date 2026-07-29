---
title: Validation
description: grove check runs on every pull request through GitHub Actions. It catches schema errors before they merge.
---

Run validation locally:

```bash
grove check            # validate + generate + sitemap + llms + robots + astro check
grove check --strict   # also fail on warnings
```

The `ci.yml` workflow runs the same command on every pull request.
Failed validation blocks merge.

What it checks:

- Each record file parses as YAML and matches the blueprint's Zod
  schema.
- `kind` matches the space's blueprint (`project` for
  `project-directory`).
- Slugs are unique across the directory.
- Required fields are present (`kind`, `name`, `description`,
  `category`).
- Enum values are valid (`projectType`, `category`, `tags`, etc.).
- Cross-record references resolve (if a record points at another
  by slug).
- Taxonomy values (`category`, `stack`, `platform`) are present in
  `data/taxonomy/*.yml`.
- Decisions in `data/decisions.yml` reference real slugs.
- Overrides in `data/overrides.yml` apply cleanly to the matching
  record.

Errors point at the file and field. Fix and re-run. The full
schema is in [Record schema reference](/reference/record-schema/).