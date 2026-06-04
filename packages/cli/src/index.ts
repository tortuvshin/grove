#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, basename } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Command } from "commander";
import {
  classifyHealth,
  enrichFromGithubHtml,
  fetchGithubMetadata,
  ghFetch as _ghFetch,
  healthFromSignals,
  importAwesomeList,
  itemsFileSchema,
  loadConfig,
  normalizeAppRecord,
  parseAppYaml,
  parseGithubRepoUrl,
  pLimit,
  readYamlFile,
  stringifyAppYaml,
  toIndexApp,
  unwrapItems,
  validateAppRecord,
  validateProject,
  writeTextFile,
  writeYamlFile,
  type CuratedConfig,
  type HealthEntry,
} from "@grove-dev/core";

const program = new Command();
const require = createRequire(import.meta.url);

program
  .name("grove")
  .description("Turn awesome lists into living, health-aware developer directories.")
  .version("0.1.0");

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

function projectConfig(projectName: string): string {
  return `import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  name: "${projectName}",
  tagline: "A living, health-aware developer directory.",
  itemLabel: "project",
});
`;
}

function projectReadme(projectName: string): string {
  return `# ${projectName}

A living, health-aware developer directory built with [Grove](https://github.com/tortuvshin/grove).

## What this is

This repository is **data + branding + decisions**, not the framework.
The CLI and static framework live in the separate \`grove\` repo.

## Workflow

\`\`\`bash
grove import <source>
grove analyze
grove review
grove validate
grove build
\`\`\`

## Files

- \`curated.config.ts\` — site name, tagline, and data paths.
- \`sources/\` — original Markdown lists that feed the directory.
- \`data/items.yml\` — parsed project list (commit this).
- \`data/apps/\` — per-app YAML records (commit this).
- \`data/health.yml\` — generated GitHub health metadata (regenerate on demand).
- \`data/overrides.yml\` — manual corrections to items.
- \`data/decisions.yml\` — human curation decisions.
- \`data/taxonomy/\` — registry of stacks, platforms, categories, distribution channels.
- \`content/methodology.md\` — the public methodology page.
- \`public/\` — logo, OG image, and other static assets.

## Health & Curation

Grove never deletes projects automatically. It produces signals
(\`active\`, \`mature\`, \`stale\`, \`inactive\`, \`archived\`, \`unknown\`,
\`historical\`, \`needs_review\`). Humans make the final call via
\`data/decisions.yml\`.

See \`content/methodology.md\` for the full methodology.
`;
}

function gitignoreTemplate(): string {
  return `node_modules/
dist/
.astro/
.DS_Store
.env
.env.*
!.env.example
data/.cache/
data/generated/
coverage/
`;
}

function taxonomyStacks(): string {
  return `- id: typescript
  name: TypeScript
  family: language
  languages: [typescript, javascript]
- id: javascript
  name: JavaScript
  family: language
  languages: [javascript]
- id: rust
  name: Rust
  family: language
  languages: [rust]
- id: go
  name: Go
  family: language
  languages: [go]
- id: python
  name: Python
  family: language
  languages: [python]
- id: flutter
  name: Flutter
  family: cross-platform
  languages: [dart]
  platforms: [ios, android, web, macos, windows, linux]
- id: react-native
  name: React Native
  family: cross-platform
  languages: [typescript, javascript]
  platforms: [ios, android]
`;
}

function taxonomyPlatforms(): string {
  return `- id: web
  name: Web
- id: ios
  name: iOS
- id: android
  name: Android
- id: macos
  name: macOS
- id: windows
  name: Windows
- id: linux
  name: Linux
- id: desktop
  name: Desktop
- id: embedded
  name: Embedded
`;
}

function taxonomyCategories(): string {
  return `- id: tools
  name: Tools
- id: libraries
  name: Libraries
- id: frameworks
  name: Frameworks
- id: applications
  name: Applications
- id: ai
  name: AI / ML
- id: devtools
  name: Developer Tools
- id: web
  name: Web
- id: mobile
  name: Mobile
- id: backend
  name: Backend
- id: infrastructure
  name: Infrastructure
`;
}

function taxonomyDistribution(): string {
  return `- id: app-store
  name: App Store
  platforms: [ios, macos]
- id: play-store
  name: Play Store
  platforms: [android]
- id: fdroid
  name: F-Droid
  platforms: [android]
- id: github-releases
  name: GitHub Releases
  platforms: [ios, android, macos, windows, linux]
- id: website
  name: Website
  platforms: [web, ios, android, macos, windows, linux]
- id: package-registry
  name: Package Registry
- id: npm
  name: npm
- id: crates-io
  name: crates.io
- id: pypi
  name: PyPI
- id: other
  name: Other
`;
}

function workflowValidate(): string {
  return `name: Validate data

on:
  pull_request:
    paths:
      - "data/**"
      - "curated.config.ts"
      - "package.json"
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run validate:data
`;
}

function workflowBuild(): string {
  return `name: Build site

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}

function issueTemplateSubmission(): string {
  return `---
name: Submit a project
about: Suggest an open-source project to add to this directory
title: "[Submit] "
labels: submission
---

## Project

- **Repository URL** (required):
- **Name**:
- **One-line description** (≤ 120 chars):
- **Category** (e.g. tools, libraries, frameworks):
- **Stack / language** (e.g. typescript, rust):
- **Platforms** (e.g. web, ios, android):

## Why include it?

A few sentences on what makes this project worth listing — maturity,
adoption, learning value, or unique qualities.

## Source

Where did you find it? (Awesome list, blog post, etc.)
`;
}

function issueTemplateBug(): string {
  return `---
name: Bug report
about: Something is broken or wrong
title: "[Bug] "
labels: bug
---

## What happened

A clear description of the bug.

## How to reproduce

Steps to reproduce the behaviour.

## Expected

What you expected to happen.
`;
}

function issueTemplateFeature(): string {
  return `---
name: Feature request
about: Suggest a new feature for this directory
title: "[Feature] "
labels: enhancement
---

## What

A clear description of the feature.

## Why

What problem does this solve?
`;
}

function licenseMIT(projectName: string): string {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year} ${projectName}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch {
    await ensureParent(path);
    await writeFile(path, content, "utf8");
  }
}

function packageNameFromProjectName(projectName: string): string {
  const name = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return name || "grove-site";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
}

function defaultTemplateDir(): string {
  const entrypoint = require.resolve("@grove-dev/astro");
  return resolve(dirname(entrypoint), "..", "template", "default");
}

async function copyDefaultTemplate(root: string): Promise<void> {
  await cp(defaultTemplateDir(), root, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
}

async function updateGeneratedPackageJson(path: string, projectName: string): Promise<void> {
  const content = await readFile(path, "utf8");
  const packageJson = JSON.parse(content) as { name?: string };
  packageJson.name = packageNameFromProjectName(projectName);
  await writeFile(path, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

program
  .command("init")
  .argument("[name]", "project directory name", ".")
  .description("Create a file-based Grove project wrapper.")
  .action(async (name: string) => {
    const root = resolve(name);
    const projectName = name === "." ? "Grove Directory" : name;
    const packageJsonPath = join(root, "package.json");
    const hadPackageJson = await fileExists(packageJsonPath);
    await mkdir(root, { recursive: true });
    await copyDefaultTemplate(root);
    await Promise.all([
      mkdir(join(root, "sources"), { recursive: true }),
      mkdir(join(root, "data"), { recursive: true }),
      mkdir(join(root, "data", "apps"), { recursive: true }),
      mkdir(join(root, "data", "taxonomy"), { recursive: true }),
      mkdir(join(root, "data", "generated"), { recursive: true }),
      mkdir(join(root, "content"), { recursive: true }),
      mkdir(join(root, "public"), { recursive: true }),
      mkdir(join(root, ".github"), { recursive: true }),
      mkdir(join(root, ".github", "ISSUE_TEMPLATE"), { recursive: true }),
      mkdir(join(root, ".github", "workflows"), { recursive: true }),
    ]);
    await writeIfMissing(join(root, "curated.config.ts"), projectConfig(projectName));
    await writeIfMissing(join(root, "README.md"), projectReadme(projectName));
    await writeIfMissing(join(root, ".gitignore"), gitignoreTemplate());
    await writeIfMissing(join(root, "data", "items.yml"), "items: []\n");
    await writeIfMissing(join(root, "data", "health.yml"), "health: []\n");
    await writeIfMissing(join(root, "data", "decisions.yml"), "decisions: []\n");
    await writeIfMissing(join(root, "data", "overrides.yml"), "overrides: []\n");
    await writeIfMissing(join(root, "data", "taxonomy", "stacks.yml"), taxonomyStacks());
    await writeIfMissing(join(root, "data", "taxonomy", "platforms.yml"), taxonomyPlatforms());
    await writeIfMissing(join(root, "data", "taxonomy", "categories.yml"), taxonomyCategories());
    await writeIfMissing(join(root, "data", "taxonomy", "distribution-channels.yml"), taxonomyDistribution());
    await writeIfMissing(
      join(root, "content", "methodology.md"),
      "# Methodology\n\nGrove uses repository metadata as a signal. Human curation decisions control final visibility.\n",
    );
    await writeIfMissing(join(root, ".github", "workflows", "validate-data.yml"), workflowValidate());
    await writeIfMissing(join(root, ".github", "workflows", "build.yml"), workflowBuild());
    await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "app_submission.md"), issueTemplateSubmission());
    await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.md"), issueTemplateBug());
    await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "feature_request.md"), issueTemplateFeature());
    await writeIfMissing(join(root, "LICENSE"), licenseMIT(projectName));
    if (!hadPackageJson) await updateGeneratedPackageJson(packageJsonPath, projectName);
    console.log(`Created Grove project at ${root}`);
  });

program
  .command("import")
  .argument("<source>", "GitHub awesome-list URL, raw README URL, or local README.md")
  .description("Import Markdown links into data/items.yml.")
  .action(async (source: string) => {
    const config = await loadConfig();
    const result = await importAwesomeList(source);
    await writeYamlFile(config.paths.items, { items: result.items });
    const report = [
      "# Import Report",
      "",
      `Source: ${source}`,
      `Imported: ${result.report.imported}`,
      `Skipped: ${result.report.skipped}`,
      `Categories: ${result.report.categories.length}`,
      `Duplicate slugs adjusted: ${result.report.duplicateSlugs}`,
      "",
      "## Categories",
      "",
      ...result.report.categories.map((category) => `- ${category}`),
      "",
    ].join("\n");
    await writeTextFile(join(config.paths.sourcesDir, "import-report.md"), report);
    console.log(`Imported ${result.items.length} items into ${config.paths.items}`);
  });

program
  .command("analyze")
  .description("Fetch GitHub metadata and generate data/health.yml.")
  .option("--limit <n>", "limit analyzed items for demos/rate limits", (value) => Number(value))
  .action(async (options: { limit?: number }) => {
    const config = await loadConfig();
    const items = unwrapItems(itemsFileSchema.parse(await readYamlFile(config.paths.items)));
    const selected = typeof options.limit === "number" ? items.slice(0, options.limit) : items;
    const health: HealthEntry[] = [];

    for (const item of selected) {
      const ref = parseGithubRepoUrl(item.links.github);
      if (!ref) {
        health.push(classifyHealth(item.id));
        continue;
      }
      console.log(`Analyzing ${ref.owner}/${ref.repo}`);
      const metadata = await fetchGithubMetadata(ref);
      health.push(classifyHealth(item.id, metadata));
    }

    await writeYamlFile(config.paths.health, { health });
    console.log(`Wrote ${health.length} health entries to ${config.paths.health}`);
  });

program
  .command("validate")
  .description("Validate project data files.")
  .action(async () => {
    const config: CuratedConfig = await loadConfig();
    const result = await validateProject(config);
    for (const issue of result.issues) {
      console.log(`${issue.code}: ${issue.message}`);
    }
    if (!result.ok) {
      process.exitCode = 1;
      console.log(`Validation failed with ${result.issues.length} issue(s).`);
      return;
    }
    console.log("Validation passed.");
  });

function runPackageScript(script: string): void {
  const child = spawn("pnpm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

program
  .command("build")
  .description("Build the static directory in the current project repo.")
  .action(() => runPackageScript("build"));

program
  .command("preview")
  .description("Preview the built static directory in the current project repo.")
  .action(() => runPackageScript("preview"));

// ──────────────────────────────────────────────────────────────────────
// grove build-data
//
// Reads curated.config.ts and the per-app yml files in data/apps/, then
// emits:
//   - data/generated/apps.full.json   (full normalized records)
//   - data/generated/apps.index.json  (lightweight list/search records)
//   - data/generated/apps.json        (compatibility alias of apps.full.json)
//   - src/data/config.ts              (typed view of curated.config.ts)
// ──────────────────────────────────────────────────────────────────────

program
  .command("build-data")
  .description("Build data/generated/*.json from data/apps/*.yml + curated.config.ts.")
  .action(async () => {
    const config = await loadConfig();
    const appsDir = resolve(process.cwd(), config.paths.appsDir);
    const outDir = resolve(process.cwd(), config.paths.generatedDir);
    await mkdir(outDir, { recursive: true });

    let entries: string[];
    try {
      entries = await readdir(appsDir);
    } catch {
      entries = [];
    }
    const files = entries.filter((f) => f.endsWith(".yml")).sort();
    const apps: Record<string, unknown>[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const fileSlug = basename(file, ".yml");
      try {
        const text = await readFile(join(appsDir, file), "utf8");
        const raw = parseAppYaml(text, fileSlug);
        const app = normalizeAppRecord(raw, fileSlug);
        if (app.slug !== fileSlug) {
          app.slug = fileSlug;
        }
        apps.push(app as unknown as Record<string, unknown>);
      } catch (err) {
        errors.push(`${file}: ${(err as Error).message}`);
      }
    }
    if (errors.length > 0) {
      console.error("[build-data] schema errors:");
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }

    apps.sort((a, b) => {
      const sa = (a as { stars?: number }).stars ?? 0;
      const sb = (b as { stars?: number }).stars ?? 0;
      if (sb !== sa) return sb - sa;
      return ((a.name as string) || "").localeCompare((b.name as string) || "");
    });
    const indexApps = apps
      .map((app) => toIndexApp(app as never))
      .filter((a) => (a as { visibility?: string }).visibility !== "hide");

    const generatedAt = new Date().toISOString();
    const fullPayload = {
      schemaVersion: 1,
      generatedAt,
      totalApps: apps.length,
      visibleApps: indexApps.length,
      apps,
    };
    const indexPayload = {
      schemaVersion: 1,
      generatedAt,
      totalApps: indexApps.length,
      apps: indexApps,
    };
    await writeFile(join(outDir, "apps.full.json"), JSON.stringify(fullPayload, null, 2), "utf8");
    await writeFile(join(outDir, "apps.index.json"), JSON.stringify(indexPayload, null, 2), "utf8");
    await writeFile(join(outDir, "apps.json"), JSON.stringify(fullPayload, null, 2), "utf8");

    // Also regenerate src/data/config.ts so Astro pages see the latest config.
    const configTs = `/**
 * AUTO-GENERATED by grove build-data — do not edit by hand.
 * Re-run \`grove build-data\` after changing curated.config.ts.
 */

export type SiteConfig = {
  name: string;
  tagline: string;
  description: string;
  siteUrl: string;
  repoUrl: string;
  itemLabel: string;
};

export const siteConfig: SiteConfig = {
  name: ${JSON.stringify(config.name)},
  tagline: ${JSON.stringify(config.tagline)},
  description: ${JSON.stringify(config.description ?? config.tagline)},
  siteUrl: ${JSON.stringify(config.siteUrl ?? "https://example.com")},
  repoUrl: ${JSON.stringify(config.repoUrl ?? "")},
  itemLabel: ${JSON.stringify(config.itemLabel)},
};
`;
    await writeFile(resolve(process.cwd(), "src/data/config.ts"), configTs, "utf8");

    console.log(
      `[build-data] wrote ${apps.length} full apps and ${indexApps.length} visible index apps\n` +
        `  full:  ${join(outDir, "apps.full.json")}\n` +
        `  index: ${join(outDir, "apps.index.json")}\n` +
        `  config: src/data/config.ts`,
    );
  });

// ──────────────────────────────────────────────────────────────────────
// grove enrich
//
// Token-free GitHub metadata enrichment via HTML scraping + shields.io.
// Reads data/apps/*.yml and patches github.repository.license,
// language, topics, homepage when missing. Re-runs are no-ops.
// ──────────────────────────────────────────────────────────────────────

program
  .command("enrich")
  .description("Enrich data/apps/*.yml with HTML-scrape GitHub metadata (no token required).")
  .option("--limit <n>", "limit enriched apps for rate limits", (value) => Number(value))
  .action(async (options: { limit?: number }) => {
    const config = await loadConfig();
    const appsDir = resolve(process.cwd(), config.paths.appsDir);
    let entries: string[];
    try {
      entries = await readdir(appsDir);
    } catch (err) {
      console.error(`[enrich] ${appsDir} does not exist.`);
      process.exit(1);
    }
    const files = entries.filter((f) => f.endsWith(".yml")).sort();
    const selected = typeof options.limit === "number" ? files.slice(0, options.limit) : files;

    let updated = 0;
    let skipped = 0;
    const failed: string[] = [];
    for (const file of selected) {
      const path = join(appsDir, file);
      const text = await readFile(path, "utf8");
      const raw = parseAppYaml(text, basename(file, ".yml"));
      const app = normalizeAppRecord(raw, basename(file, ".yml"));
      if (!app.repoUrl) {
        skipped++;
        continue;
      }
      process.stdout.write(`[enrich] ${app.slug} ... `);
      const res = await enrichFromGithubHtml(app.repoUrl);
      if (res.notFound) {
        process.stdout.write("skip (404)\n");
        skipped++;
        continue;
      }
      if (res.rateLimited) {
        process.stdout.write("rate-limited\n");
        failed.push(`${app.slug}: rate-limited`);
        continue;
      }
      if (res.error) {
        process.stdout.write(`error: ${res.error}\n`);
        failed.push(`${app.slug}: ${res.error}`);
        continue;
      }
      const f = res.fields;
      const repo = (raw.github as Record<string, unknown>)?.repository as Record<string, unknown> | undefined;
      const next = {
        ...(repo ?? {}),
        ...(f.license ? { license: { spdx_id: f.license, key: null, name: null, url: null } } : {}),
        ...(f.language ? { language: f.language } : {}),
        ...(f.topics.length > 0 ? { topics: f.topics } : {}),
        ...(f.homepage ? { homepage: f.homepage } : {}),
      } as Record<string, unknown>;
      const nextDoc = { ...raw, github: { ...(raw.github as object ?? {}), repository: next } };
      const out = stringifyAppYaml(nextDoc);
      if (out !== text) {
        await writeFile(path, out, "utf8");
        process.stdout.write(`updated (license=${f.license ?? "—"} lang=${f.language ?? "—"})\n`);
        updated++;
      } else {
        process.stdout.write("no change\n");
      }
    }
    console.log(`\n[enrich] ${updated} updated, ${skipped} skipped, ${failed.length} failed`);
  });

// ──────────────────────────────────────────────────────────────────────
// grove review
//
// Reports cleanup candidates from data/apps/*.yml (per health.status /
// health.tier). Writes data/generated/review-report.json and a stub
// data/decisions.yml the curator can fill in.
// ──────────────────────────────────────────────────────────────────────

program
  .command("review")
  .description("List items that need human curation (cleanup candidates, unknown, etc).")
  .action(async () => {
    const config = await loadConfig();
    const appsDir = resolve(process.cwd(), config.paths.appsDir);
    const outDir = resolve(process.cwd(), config.paths.generatedDir);
    await mkdir(outDir, { recursive: true });
    let entries: string[];
    try {
      entries = await readdir(appsDir);
    } catch (err) {
      console.error(`[review] ${appsDir} does not exist.`);
      process.exit(1);
    }
    const files = entries.filter((f) => f.endsWith(".yml")).sort();
    const candidates: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const fileSlug = basename(file, ".yml");
      const raw = parseAppYaml(await readFile(join(appsDir, file), "utf8"), fileSlug);
      const app = normalizeAppRecord(raw, fileSlug);
      if (app.cleanupCandidate || app.status === "unknown" || app.status === "needs_review") {
        candidates.push({
          slug: app.slug,
          name: app.name,
          repoUrl: app.repoUrl,
          status: app.status,
          tier: app.tier,
          staleReason: app.staleReason,
          lastCommitAt: app.lastCommitAt ?? null,
          stars: app.stars ?? 0,
        });
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      totalCandidates: candidates.length,
      candidates,
    };
    await writeFile(join(outDir, "review-report.json"), JSON.stringify(report, null, 2), "utf8");
    console.log(`[review] ${candidates.length} candidate(s) → ${join(outDir, "review-report.json")}`);
    for (const c of candidates.slice(0, 10)) {
      console.log(`  - ${c.slug} (${c.status}, ${c.stars}★)`);
    }
  });

// ──────────────────────────────────────────────────────────────────────
// grove build-llms-full
//
// Reads data/generated/apps.full.json and writes public/llms.txt +
// public/llms-full.txt. Mirrors the original Open Apps script.
// ──────────────────────────────────────────────────────────────────────

program
  .command("build-llms-full")
  .description("Generate public/llms.txt and public/llms-full.txt from generated apps data.")
  .action(async () => {
    const config = await loadConfig();
    const outDir = resolve(process.cwd(), config.paths.generatedDir);
    const publicDir = resolve(process.cwd(), "public");
    await mkdir(publicDir, { recursive: true });
    const appsPath = join(outDir, "apps.full.json");
    let payload: { generatedAt?: string; apps?: Array<Record<string, unknown>> };
    try {
      payload = JSON.parse(await readFile(appsPath, "utf8"));
    } catch {
      payload = { apps: [] };
    }
    const apps = payload.apps ?? [];
    const slug = (s: string) =>
      String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const visible = apps.filter((a) => a.visibility !== "hide");
    const index = visible
      .map((a) => {
        const s = slug(a.slug as string);
        const desc = String(a.description ?? "").replace(/\s+/g, " ").slice(0, 120);
        return `- [${a.name}](#${s}) — ${a.category} · ${a.stack ?? "—"} · ${a.stars ?? 0}★ — ${desc}`;
      })
      .join("\n");
    const llmsTxt = `# ${config.name}

${config.description ?? config.tagline}

Directory: ${config.siteUrl ?? ""}/apps
Projects indexed: ${visible.length}
Categories: ${new Set(visible.map((a) => a.category)).size}

## Usage

Use /llms-full.txt for project-level details. Prefer project detail pages for citations.
`;
    const llmsFull = [
      `# ${config.name} — full directory`,
      "",
      `> Generated ${payload.generatedAt ?? new Date().toISOString()} from ${apps.length} app records.`,
      "> Source: " + (config.siteUrl ?? "") + "/apps · Regenerate with `pnpm run build:llms-full`.",
      "",
      "Each section below mirrors one app detail page.",
      "",
      "## Index",
      "",
      index,
      "",
    ].join("\n");
    await writeFile(join(publicDir, "llms.txt"), llmsTxt, "utf8");
    await writeFile(join(publicDir, "llms-full.txt"), llmsFull, "utf8");
    console.log(`[build-llms-full] wrote ${publicDir}/llms.txt and llms-full.txt`);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
