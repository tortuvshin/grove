---
title: "Methodology"
description: "How records are picked, scored, and surfaced in this directory."
---

# Methodology

This page describes how entries in the directory are chosen, how the
curation signals are computed, and what we do (and don't) promise about
the data. The intent is to make the directory's logic auditable — every
number on a detail page is reproducible from the record's YAML.

## Selection

A record is included if it is:

1. **Open source.** Source is public under an OSI-approved license
   (or public-domain dedication).
2. **Actively maintained.** A pushed commit within the last 18 months
   OR a declared maintenance status of `maintained` / `passive`.
3. **Useful to a curious developer.** A working build, a real user
   base (or a credible path to one), and a clear description of what
   the project does.

We exclude: abandoned experiments, vapourware, projects whose entire
purpose is to sell a hosted plan, and any record that has not been
hand-checked by a maintainer.

## Curation labels

The `curation.labels` field is a small, hand-set list. The supported
labels are:

- `hot` — high recent activity or attention (≥ 1 000 stars or a
  commit within the last 30 days).
- `new` — added to the directory in the last 7 days.
- `mature` — long-running curated project, pushed > 365 days ago,
  but still maintained.
- `featured` — editor's pick for the front page.
- `needs-review` — open submission awaiting a second maintainer
  look.

These labels are mutually additive, not exclusive. A `new` record
can also be `hot`; a `mature` record can also be `featured`.

## Scoring

The detail page surfaces a five-dimension score block. The five
dimensions are:

- **Documentation** — is the README / docs site enough to onboard
  without reading the source?
- **Onboarding** — install in < 5 min, first useful result in < 1 h.
- **Maintenance** — recent commits, issue close rate, release cadence.
- **Community** — issues answered, discussions active, contributors
  per release.
- **Production-readiness** — CI, tests, security policy, releases
  with semver.

Each dimension is scored 0-5. The overall score on the detail page
is the mean. Scores are stored on the record, not computed at build
time, so we can deliberately disagree with the raw signals (a 1-line
toy that happens to be wildly popular can still score low on
documentation).

## Health signals

The `health` block on each record tracks four state machines:

- `status` — `healthy` / `slowing` / `stale` / `archived`.
- `tier` — `curated` / `community` / `experimental`.
- `issue_close_rate` — moving 90-day average.
- `last_release` — most recent semver tag.

A record's `status` transitions are time-boxed: a project with no
commits in 365 days flips from `slowing` to `stale`; 730 days flips
to `archived`. The transition is mechanical; the recovery is
manual (a maintainer sets `tier` back to `community` after review).

## Lenses

The directory's home page surfaces three curated lenses:

- **Hot** — `curation.labels` includes `hot`, OR `github.stars` ≥
  1 000, OR `pushedAt` within 30 days.
- **New** — `pushedAt` within 7 days, OR `curation.labels` includes
  `new`.
- **Mature** — `health.tier === "curated"` AND `pushedAt` > 365 days
  ago.

Each lens caps at 6 items on the home page; the full filtered list
is reachable via the lens tab on `/projects`.

## What we don't promise

- **Real-time data.** The site is rebuilt on a schedule, not on
  every push. Counts and dates can lag by up to one build cycle.
- **Verdict-free scores.** A high overall score means "useful to a
  curious developer", not "best in class" — judgement calls are
  documented per record, not baked into the score.
- **Causal claims.** The "best for" / "why listed" / "caveats"
  blocks are editorial notes, not derived signals. They reflect
  what a maintainer thought at review time.
