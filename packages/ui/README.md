# `@grove-dev/ui`

> **Roadmap only — not in V1.** See [docs/roadmap.md](../docs/roadmap.md).

`@grove-dev/ui` was the V0 framework-agnostic UI primitives package
(`filterRecords`, `sortRecords`, `paginateRecords`, `scoreTier`, ...). The
V1 data model is a discriminated union of `ProjectRecord`,
`ResourceRecord`, and `EntityRecord` (see `@grove-dev/core/schema`).
The V0 helpers that hung off the flat `CuratedItem` type do not carry
over, and rebuilding them on top of the new schemas is a Wave 2 task.

For V1 work, import `Resource`, `ProjectRecord`, `ResourceRecord`, or
`EntityRecord` directly from `@grove-dev/core` and write the page logic
against the blueprint the site configures (`grove.config.ts` →
`blueprint`).

The package remains in the workspace so consumers that already depend
on `@grove-dev/ui` do not break, but it currently exports only an
identity helper and a version constant. Do not depend on it for new
work in V1.

## Status

- `0.0.0-roadmap` — stub release; do not import in production.
- See [`docs/roadmap.md`](../docs/roadmap.md) and
  [`docs/MILESTONES.md`](../docs/MILESTONES.md) for the V1 release plan
  and the Wave 2 schedule.

## License

MIT
