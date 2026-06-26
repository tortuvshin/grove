---
title: Validation
description: grove validate runs on every pull request through GitHub Actions. It catches schema errors before they merge.
---

Run validation locally:

```bash
grove validate            # check schemas, slugs, taxonomy
grove validate --strict   # also fail on warnings
```

The `validate-data.yml` workflow runs the same command on every pull request. Failed validation blocks merge.

What it checks:

- Each record file parses as YAML and matches the blueprint's Zod schema
- `kind` matches the space's blueprint (`project` for `project-directory`)
- Slugs are unique across the directory
- Required fields are present (`kind`, `slug`, `name`, `description`)
- Enum values are valid (`projectType`, `category`, etc.)
- Cross-record references resolve (if a record points at another by slug)

Errors point at the file and field. Fix and re-run.