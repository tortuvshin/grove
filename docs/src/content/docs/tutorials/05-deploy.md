---
title: 5. Deploy
description: Push the space to a real URL. Pick a target, wire up GitHub Actions, and turn on the maintenance cron that keeps records fresh.
---

In the previous tutorials the site lived at `http://localhost:4321`. In
this one we put it on the public internet and turn on the cron jobs that
keep the records healthy.

## Step 1 — Pick a target

Grove is a static site generator. The output of `pnpm build` is a folder
of HTML, CSS, JS, and JSON. You can host it anywhere that serves static
files. The CLI scaffolds a workflow for each of the common targets:

| Target      | Best for                                               | Output         |
| ----------- | ------------------------------------------------------ | -------------- |
| **Vercel**  | Fastest setup, generous free tier, automatic previews. | Edge + static. |
| **Netlify** | Same as Vercel, slightly different pricing.            | Edge + static. |
| **Cloudflare Pages** | Cheapest at scale, no bandwidth cap.           | Edge + static. |
| **GitHub Pages** | Free for public repos, no CI minutes.            | Static only.   |

The build output is the same for all four. The differences are in the
deploy workflow and the CDN. For this tutorial we'll go with Vercel; the
other three follow the same shape.

## Step 2 — Make sure the build is clean

Before deploying, confirm the build succeeds locally:

```bash
pnpm build
```

You should see:

```text
✓ 5 records read
✓ taxonomy validated
✓ health signals derived
✓ decisions applied
✓ data/generated/records.full.json written
✓ data/generated/records.index.json written
✓ 8 pages emitted
✓ sitemap.xml written
✓ llms.txt written
✓ build complete in 4.2s
```

If you see errors, fix them before deploying. A failed build that gets
pushed is much worse than a build that fails locally.

## Step 3 — Push the repo to GitHub

If you haven't already:

```bash
git add -A
git commit -m "Initial Grove space"
git remote add origin git@github.com:your-org/my-space.git
git push -u origin main
```

Make sure `.env`, `node_modules/`, and `dist/` are in `.gitignore`. The
CLI scaffolded a `.gitignore` that handles this; double-check it.

## Step 4 — Wire up the Vercel deploy

You have two options.

### Option A — Vercel UI (5 minutes)

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `my-space` repo.
3. Vercel auto-detects Astro. The build command is `pnpm build`, the
   output directory is `dist`. Both are correct by default.
4. Click **Deploy**. The first build runs in ~60 seconds.

### Option B — Vercel GitHub Action (recommended for CI integration)

The CLI wrote `.github/workflows/deploy.yml` when you ran
`pnpm grove workflows sync`. To make it work, add two secrets to your
GitHub repo:

- `VERCEL_TOKEN` — get it from Vercel → Account Settings → Tokens.
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — from the project's settings
  page, or use the Vercel CLI:
  ```bash
  npx vercel link
  cat .vercel/project.json
  ```

Add the secrets in GitHub → Settings → Secrets → Actions. Push to `main`
and the action deploys. Subsequent pushes redeploy automatically.

## Step 5 — Set up the maintenance cron

A Grove space that's never updated becomes a graveyard. The `grove
workflows sync` command wrote a cron-style workflow at
`.github/workflows/refresh.yml`:

```yaml
# .github/workflows/refresh.yml (auto-generated)
name: Refresh records
on:
    schedule:
        - cron: '0 6 * * 1'   # Mondays at 06:00 UTC
    workflow_dispatch: {}

jobs:
    refresh:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v3
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
            - run: pnpm install --frozen-lockfile
            - run: pnpm grove sync github
            - run: pnpm grove cleanup stale --threshold 180
            - run: pnpm grove generate
            - uses: pnpm/action-setup@v3
            - run: |
                git config user.name "grove-bot"
                git config user.email "grove-bot@users.noreply.github.com"
                git diff --quiet || (git add -A && git commit -m "chore: refresh enrichment [skip ci]" && git push)
```

The default schedule is weekly. Tweak it by editing the `cron:` line —
`0 6 * * 1` is every Monday at 06:00 UTC; `0 */6 * * *` is every six
hours. For a 100-record space with the public GitHub API, weekly is safe;
with a token, every six hours is fine.

:::caution[GitHub Actions cron accuracy]
GitHub's scheduled workflows can be delayed by up to 30 minutes during
peak hours, and may be skipped entirely if no runners are available. Don't
rely on the cron for time-sensitive updates; use it for steady maintenance.
:::

For the cron to push back to the repo, the workflow needs write
permissions. In GitHub → Settings → Actions → General → Workflow
permissions, pick **Read and write permissions**.

## Step 6 — Configure the custom domain

Once the deploy is live, add your domain. The exact steps depend on the
host:

- **Vercel:** Project → Settings → Domains → Add. Vercel walks you
  through the DNS records.
- **Netlify:** Same, under Domain settings.
- **Cloudflare Pages:** Custom domains tab; Cloudflare is usually the DNS
  provider too, so the records are added automatically.
- **GitHub Pages:** Repo → Settings → Pages → Custom domain. Add a
  `CNAME` file at the repo root with the domain name.

For `https://ts-tools.example.com` (from Tutorial 3), set:

```text
CNAME  ts-tools  cname.vercel-dns.com
```

DNS propagation takes a few minutes. HTTPS is automatic on all four
targets via Let's Encrypt.

## Step 7 — Set up monitoring

A deployed site is a deployed site — something will eventually go wrong.
Three things to check weekly:

1. **GitHub Actions runs.** All three workflows should be green. A red
   `validate.yml` means a contributor PR broke something; a red
   `refresh.yml` means the cron hit a rate limit.
2. **404s in your CDN logs.** Vercel and Netlify surface this on the
   project dashboard. A spike in 404s usually means a record was renamed
   and old links are dangling.
3. **Search console.** Submit the sitemap to Google Search Console (URL
   is `https://ts-tools.example.com/sitemap.xml`). The Search Console
   "Coverage" report will tell you which pages Google is failing to
   index.

The CLI has a `grove doctor` command that runs the first two checks
locally and prints a summary. It's not a substitute for production
monitoring, but it catches the obvious regressions.

## Step 8 — Announce the space

The last step is the first step of the next phase: tell your community
the space exists. A few options:

- **Issue in the parent org.** If your space sits in a larger GitHub
  org, open an issue in the org's "meta" repo linking to the deployed
  URL.
- **Submit to the Grove showcase.** Grove maintains a list of live
  spaces at `https://grove.dev/showcase/`. To add yours, open a PR
  against `grovedev/grove` adding a record to
  `data/showcase/spaces.yml`.
- **Add the badge.** Grove ships a small badge you can put in your
  README: `[![Built with Grove](https://grove.dev/badge.svg)](https://grove.dev)`.

## Recap — what you have now

A public space at `https://ts-tools.example.com` with:

- Five real records, validated and rendering correctly.
- A customized theme, navigation, and facet configuration.
- GitHub enrichment running weekly.
- A `cleanup stale` cron flagging records for review.
- CI that catches schema drift on every PR.
- HTTPS, a sitemap, and an `llms.txt` for AI agents.

The site is ready to be the canonical directory for your community.
The work from here is incremental: add records, retire records, refine
the taxonomy as the community's needs change. Grove is designed for
that loop — every operation is a normal git commit, every check is
visible in CI, every record has an auditable history.

## Where to go next

- **[The data model](/guides/data-model/)** — deeper dive into the
  schema, taxonomy semantics, and the `data/` directory layout.
- **[Spaces & blueprints](/guides/spaces/)** — what the other two
  blueprints (`resource-hub`, `ecosystem-map`) are for and when to
  use them.
- **[CLI reference](/reference/cli/)** — every command, every flag.
- **[grove.config.ts reference](/reference/config/)** — every config
  field, every default.
- **[Resource schema reference](/reference/schema/)** — the canonical
  field list for every record kind.
