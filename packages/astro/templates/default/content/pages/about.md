---
title: "About"
description: "What this directory is, who it's for, and how it works."
---

# About this directory

This site is a small, hand-curated index of useful open-source work
relevant to a specific community. The framing is deliberately
narrow: we list *one* project per record, with a hand-written
"why listed" note for each, and we surface the things that matter
in practice (recent activity, install friction, license, etc.)
rather than the things that look impressive on a GitHub profile.

## How it works

Records live as YAML files in `data/records/`. Each record carries:

- A `kind` (`project`, `resource`, or `entity` — picked by the
  blueprint in `grove.config.ts`).
- A `slug` (URL-safe identifier; becomes the path on
  `/<kind>/<slug>`).
- A `name` and a one-line `description`.
- Cross-links (`links.github`, `links.website`, etc.) and free-form
  tags.
- An optional `curation` block with `labels`, `reviewedAt`,
  `bestFor`, `whyListed`, `caveats`, and `scores`.
- An optional `github` block with the live repository signals
  (stars, forks, latest release, languages, pushed-at).

At build time:

1. `grove validate` checks every record against the JSON schema.
2. `grove generate` writes `data/generated/records.{full,index}.json`
   and `data/generated/site-config.json`.
3. `grove sitemap` writes `public/sitemap.xml`.
4. `grove llms` writes `public/llms.txt` and `llms-full.txt`.
5. `astro build` produces the static output.

The whole pipeline is reproducible. The records are the source of
truth; everything else is derived.

## Why a static site

The directory is a *reference*, not an *app*. Static HTML is the
right tool:

- Every page is a single round-trip. No client-side data layer.
- The output is auditable: open the deployed HTML and you can see
  the full markup, no hidden hydration.
- Hosting is cheap (or free, on GitHub Pages / Cloudflare Pages).
- AI crawlers can read the full content. The `llms.txt` /
  `llms-full.txt` files give them a single fetch to land on.

## Contributing

To add a record, open a submission issue. The maintainer will
review and, if accepted, open a PR that adds the new YAML file.
See `/submit` for the issue form and a minimal record template.

## License

The site's source code is MIT. The records are released under CC-BY
4.0 unless a record's `license` field says otherwise. A record's
`license` field is the license of the *project it describes*, not
the license of the directory entry.
