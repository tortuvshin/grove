---
title: Categories and tags
description: Categories are curated, finite, and used for filtering. Tags are open, free-form, and good for cross-cutting concerns.
---

Two fields shape the browse experience: **categories** and **tags**.

- **Categories** are curated and finite. Every record belongs to one. They appear as primary filter chips on the list page.
- **Tags** are open and free-form. A record can carry many. They appear as secondary chips and in search.

Set which fields are exposed as facets in `grove.config.ts`:

```ts
facets: ["category", "stacks", "platforms", "tags"],
```

Add a new category by writing the second record that uses it — the taxonomy is implicit in the records. Configure a custom display name in `data/taxonomy/`.