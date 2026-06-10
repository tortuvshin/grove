---
title: 4. Maintain the space
description: Keep records accurate over time — health signals, GitHub metadata sync, decision tracking, stale-record cleanup, and contribution flow.
---

A Grove space is meant to live for years, not weeks. The interesting work
starts after the launch: a project changes its license, gets archived, or
ships a major version. This tutorial is about the four maintenance
mechanisms Grove gives you so the directory stays useful as the world
under it changes.

## Step 1 — Enable GitHub enrichment

When you scaffolded the space, you picked `none` for GitHub integration.
Flip that on now.

Edit `grove.config.ts`:

```ts
integrations: {
    github: {
        enabled: true,
        mode: 'public',   // 'public' uses the unauthenticated API (60 req/h);
                          // 'token' uses $GITHUB_TOKEN (5000 req/h)
        enrichFields: ['stars', 'language', 'license', 'pushedAt', 'archived'],
    },
},
```

Three things to know:

- **`mode: 'public'`** uses the unauthenticated GitHub REST API. It works
  for small spaces (a few hundred records) but hits the rate limit fast.
- **`mode: 'token'`** uses a `GITHUB_TOKEN` environment variable. The
  token needs `public_repo` scope and nothing else. We recommend this for
  any space with more than 50 records.
- **`enrichFields`** is the allowlist. Fields not in this list are never
  fetched and never written.

Now run the sync:

```bash
pnpm grove sync github
```

The CLI walks every record with a `repoUrl`, hits the GitHub API, and
writes the enrichment into the record's `github:` block:

```yaml
github:
    stars: 32100
    language: TypeScript
    license: MIT
    pushedAt: 2024-04-22
    archived: false
    fetchedAt: 2024-04-23T10:14:00Z
```

`fetchedAt` is set on every run, so you always know how stale the
enrichment is. The original record file is updated in place — the change
goes into Git as a normal edit, so a human can review it via PR.

## Step 2 — Configure health signals

The `data/health.yml` file is a tiny rule engine. It reads the GitHub
enrichment (and any custom field you define) and produces a derived
`health:` block on every record:

```yaml
# data/health.yml
signals:
    status:
        derive: github.archived
        map:
            true: archived
            false: active

    activity:
        derive: github.pushedAt
        map:
            - when: '< 90 days ago'
              then: active
            - when: '< 365 days ago'
              then: slow
            - when: '>= 365 days ago'
              then: stale

    popularity:
        derive: github.stars
        map:
            - when: '< 100'
              then: niche
            - when: '< 5000'
              then: established
            - when: '>= 5000'
              then: well-known
```

Each signal has:

- **`derive`** — the path into the record it reads.
- **`map`** — either a direct value-to-status map, or a list of
  `when/then` conditions. Conditions are evaluated top-down; the first
  match wins.

The default `health.yml` from the scaffold ships three signals: `status`,
`activity`, and `popularity`. You're free to delete them, add more, or
rename them. The schema doesn't care about the names; it only cares that
every signal returns a string.

Re-generate to see the new health block:

```bash
pnpm grove generate
```

The detail page for `/projects/zod` now shows a "Health" card with
`status: active`, `activity: active`, `popularity: well-known`. These are
the values your facets and filters operate on.

## Step 3 — Track decisions

Some records are *featured* — they deserve a callout on the homepage. Some
are *deprecated* — we keep them for historical context but hide them from
the default listing. Some are *in-review* — a contributor added them but
the maintainers haven't blessed them yet. Decisions are how you encode
this:

`data/decisions.yml`:

```yaml
# data/decisions.yml
decisions:
    - slug: zod
      visibility: featured
      reviewedBy: '@maintainer-alice'
      reviewedAt: 2024-04-10
      note: Foundational library; safe to highlight.

    - slug: effect
      visibility: default
      reviewedBy: '@maintainer-bob'
      reviewedAt: 2024-04-18
      note: Approved but not featured — learning curve is real.
```

The six possible `visibility` values are:

| Visibility     | What it means                                                                |
| -------------- | ---------------------------------------------------------------------------- |
| `featured`     | Listed on the homepage; appears first in category pages.                     |
| `default`      | Listed normally in its category.                                             |
| `unlisted`     | Accessible at `/projects/<slug>` but not in any index page.                  |
| `draft`        | Excluded from the build entirely. Used for work-in-progress.                 |
| `archived`     | Excluded from listings; preserved at `/archive/<slug>`.                      |
| `deprecated`  | Listed with a "Deprecated" banner; not surfaced in facets.                   |

`draft` and `archived` are *also* achievable by moving the file out of
`data/records/` into `data/drafts/` or `data/archive/`. Decisions are for
the cases where you want the record in the canonical location but flagged
differently.

## Step 4 — Run cleanup

A year in, you'll have records that are stale for reasons *not* covered
by GitHub data — maybe the project was renamed, the homepage moved, or
someone flagged it as low-quality. `grove cleanup stale` finds them:

```bash
pnpm grove cleanup stale --threshold 180
```

It writes a report at `data/generated/stale.yml`:

```yaml
generatedAt: 2024-04-23T11:02:14Z
thresholdDays: 180
stale:
    - slug: some-archived-project
      reasons:
          - github.pushedAt is 412 days old
          - homepage link returns 404
    - slug: renamed-project
      reasons:
          - description references the old name "FooBar"
```

The default rules look for: GitHub inactivity beyond the threshold, dead
homepage links (404/5xx), and missing enrichment for records that have a
`repoUrl`. You can extend the rules in `data/health.yml` under the
`cleanup:` block.

The output is YAML, not a side-channel. You commit it, review the list,
and either fix the records or move them to `data/archive/`.

## Step 5 — Accept community contributions

A Grove space is a git repo, which means the contribution flow is just a
PR. But the friction is real: a new contributor has to clone, install,
learn the schema, and avoid the common pitfalls. Grove ships two things
to make this easy.

### Issue template

Generate one with:

```bash
pnpm grove workflows sync
```

This writes (or refreshes) the files in `.github/`:

```text
.github/
├── workflows/
│   ├── validate.yml         # runs on every PR
│   ├── generate.yml         # runs after merge
│   └── deploy.yml           # runs on main
├── ISSUE_TEMPLATE/
│   └── new-record.yml       # structured form for "add a project" issues
└── PULL_REQUEST_TEMPLATE.md # checklist for record contributions
```

The `new-record.yml` template asks the contributor for `name`, `category`,
`description`, `repoUrl`, and `whyListed`. The bot then opens a draft PR
that pre-fills the record file using the same format you saw in
[Tutorial 2](/tutorials/02-author-records/).

### Required checks

`validate.yml` runs on every PR and fails the merge if:

- Any record has a missing required field.
- Any record references a category or topic that isn't in `taxonomy.yml`.
- The `data/generated/` JSON is out of date (someone forgot to run
  `pnpm grove generate`).

The third check is the important one — it means a contributor who adds a
record but forgets to regenerate will get a clear error message and a
suggested command, instead of a silently broken build on `main`.

## What you learned

- `grove sync github` enriches records from the GitHub API.
- `data/health.yml` derives a `health:` block from any field on the record.
- `data/decisions.yml` encodes visibility, featured status, and review
  state.
- `grove cleanup stale` flags records that need human attention.
- `grove workflows sync` installs the CI and issue templates that turn
  PRs into the right shape.

**Next: [Tutorial 5 — Deploy](/tutorials/05-deploy/)** — push the space
to a real URL and turn on the cron that keeps it healthy.
