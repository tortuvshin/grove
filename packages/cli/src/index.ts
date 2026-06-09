#!/usr/bin/env node
/**
 * Grove CLI — turns awesome lists into living, health-aware developer directories.
 *
 * Layered on top of `@grove-dev/core`. The CLI is intentionally
 * framework-agnostic: it orchestrates `core` functions and asks the
 * matching framework adapter (e.g. `@grove-dev/astro`) for templates
 * to scaffold a project.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import * as p from "@clack/prompts";
import {
  buildData,
  buildLlmsFiles,
  buildReviewReport,
  buildSitemap,
  classifyHealth,
  enrichFromGithubHtml,
  fetchGithubMetadata,
  healthFromSignals,
  importAwesomeList,
  itemsFileSchema,
  loadConfig,
  parseAppYaml,
  parseGithubRepoUrl,
  pLimit,
  readYamlFile,
  toIndexApp,
  type CuratedConfig,
  type HealthEntry,
  normalizeAppRecord,
  stringifyAppYaml,
  validateProject,
  writeTextFile,
  writeYamlFile,
} from "@grove-dev/core";
import {
  copyTemplate,
  ensureDir,
  isFramework,
  listTemplates,
  renameProjectInTemplate,
  SUPPORTED_FRAMEWORKS,
  type DeployProvider,
  type Framework,
} from "./template-loader.js";

const program = new Command();

const DEPLOY_PROVIDERS = ["vercel", "netlify", "cloudflare", "github-pages", "none"] as const;
const DEPLOY_LABELS: Record<DeployProvider, { label: string; hint: string }> = {
  vercel: { label: "Vercel", hint: "Vercel — best for Next.js and SSR" },
  netlify: { label: "Netlify", hint: "Netlify — strong form handling and edge" },
  cloudflare: { label: "Cloudflare Pages", hint: "Cloudflare Pages — global edge" },
  "github-pages": { label: "GitHub Pages", hint: "GitHub Pages — free for public repos" },
  none: { label: "None", hint: "I'll bring my own deploy — no workflow" },
};
const FRAMEWORK_LABELS: Record<Framework, { label: string; hint: string }> = {
  astro: { label: "Astro", hint: "Static-first, great for content sites" },
  nextjs: { label: "Next.js", hint: "App router + RSC, React ecosystem" },
  svelte: { label: "SvelteKit", hint: "Compact, fast, single-file components" },
};

program
  .name("grove")
  .description("Turn awesome lists into living, health-aware developer directories.")
  .version("0.1.0");

// ──────────────────────────────────────────────────────────────────────
// grove new
//
// Scaffold a brand-new project repo. Interactive by default
// (matches `pnpm create astro`, `create-next-app`, etc.); every
// prompt has a CLI flag for non-interactive use.
// ──────────────────────────────────────────────────────────────────────
program
  .command("new")
  .argument("[name]", "project directory name (current dir if omitted)")
  .description("Scaffold a new Grove project from a framework template.")
  .option("-f, --framework <name>", "framework: astro | nextjs | svelte")
  .option("-t, --template <name>", "template name", "default")
  .option("-d, --deploy <provider>", `deploy provider: ${DEPLOY_PROVIDERS.join(" | ")}`)
  .option("--no-git", "skip `git init` after scaffolding")
  .option("--no-install", "skip `pnpm install` after scaffolding")
  .option("-y, --yes", "accept defaults for every prompt (CI / scripted use)")
  .action(
    async (
      name: string | undefined,
      opts: {
        framework?: string;
        template: string;
        deploy?: string;
        git?: boolean;
        install?: boolean;
        yes?: boolean;
      },
    ) => {
      p.intro("🌱 Grow a new Grove space");

      // ── 1. Project name ────────────────────────────────────────
      // Non-interactive path: if --yes was passed OR a name positional was
      // given, skip both text prompts and derive values from the args.
      // Without this, the CLI hangs on `p.text` in non-TTY environments
      // (CI, agent shells, piped stdin) because clack has no TTY to read from.
      const projectDir: string =
        opts.yes || name ? name ?? "." : await resolveText("Where should the new space live?", ".");
      const projectName: string =
        opts.yes || name
          ? (projectDir === "." ? "Grove Directory" : projectDir)
          : await resolveText("What is the name of this space?", "Grove Directory");

      // ── 2. Framework ───────────────────────────────────────────
      let framework: Framework;
      if (opts.framework && isFramework(opts.framework)) {
        framework = opts.framework;
      } else if (opts.framework) {
        p.log.error(`Unknown framework: ${opts.framework}.`);
        p.log.info(`Try one of: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
        process.exit(1);
      } else if (opts.yes) {
        framework = "astro";
      } else {
        const f = await p.select({
          message: "Pick a framework",
          options: SUPPORTED_FRAMEWORKS.map((f) => ({
            value: f,
            label: FRAMEWORK_LABELS[f].label,
            hint: FRAMEWORK_LABELS[f].hint,
          })),
          initialValue: "astro",
        });
        if (p.isCancel(f)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        framework = f as Framework;
      }

      // ── 3. Template name ───────────────────────────────────────
      const template = opts.template;

      // ── 4. Deploy provider ─────────────────────────────────────
      let deploy: DeployProvider;
      if (opts.deploy && (DEPLOY_PROVIDERS as readonly string[]).includes(opts.deploy)) {
        deploy = opts.deploy as DeployProvider;
      } else if (opts.deploy) {
        p.log.error(`Unknown deploy provider: ${opts.deploy}.`);
        p.log.info(`Try one of: ${DEPLOY_PROVIDERS.join(", ")}`);
        process.exit(1);
      } else if (opts.yes) {
        deploy = "github-pages";
      } else {
        const d = await p.select({
          message: "Where will this space be deployed?",
          options: DEPLOY_PROVIDERS.map((d) => ({
            value: d,
            label: DEPLOY_LABELS[d].label,
            hint: DEPLOY_LABELS[d].hint,
          })),
          initialValue: "github-pages",
        });
        if (p.isCancel(d)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        deploy = d as DeployProvider;
      }

      // ── 5. git init? ───────────────────────────────────────────
      const initGit = opts.yes
        ? (opts.git ?? true)
        : await p.confirm({
            message: "Initialize a git repository?",
            initialValue: opts.git ?? true,
          });
      if (p.isCancel(initGit)) {
        p.cancel("Aborted.");
        process.exit(0);
      }

      // ── 6. install deps? ───────────────────────────────────────
      const installDeps = opts.yes
        ? (opts.install ?? true)
        : await p.confirm({
            message: "Install dependencies with pnpm?",
            initialValue: opts.install ?? true,
          });
      if (p.isCancel(installDeps)) {
        p.cancel("Aborted.");
        process.exit(0);
      }

      // ── 7. scaffold ────────────────────────────────────────────
      const root = resolve(projectDir);
      const templates = await listTemplates(framework);
      const tpl = templates.find((t) => t.template === template) ?? templates[0];
      if (!tpl) {
        p.log.error(`No templates found for ${framework}.`);
        process.exit(1);
      }

      const s = p.spinner();
      s.start("Scaffolding");

      await mkdir(root, { recursive: true });
      await copyTemplate(framework, root, tpl.template);
      const renameResult = await renameProjectInTemplate(framework, root, projectName, tpl.template);
      if (renameResult.rewrittenDeps.length > 0) {
        p.log.step(
          `Rewrote workspace deps to published version: ${renameResult.rewrittenDeps.join(", ")}`,
        );
      }

      await Promise.all([
        ensureDir(join(root, "sources")),
        ensureDir(join(root, "data")),
        ensureDir(join(root, "data", "apps")),
        ensureDir(join(root, "data", "taxonomy")),
        ensureDir(join(root, "data", "generated")),
        ensureDir(join(root, "content")),
        ensureDir(join(root, "public")),
        ensureDir(join(root, ".github")),
        ensureDir(join(root, ".github", "ISSUE_TEMPLATE")),
        ensureDir(join(root, ".github", "workflows")),
      ]);
      await writeIfMissing(join(root, "curated.config.ts"), projectConfig(projectName));
      await writeIfMissing(join(root, "README.md"), projectReadme(projectName, framework));
      await writeIfMissing(join(root, ".gitignore"), gitignoreTemplate());
      await writeIfMissing(join(root, "data", "items.yml"), "items: []\n");
      await writeIfMissing(join(root, "data", "health.yml"), "health: []\n");
      await writeIfMissing(join(root, "data", "decisions.yml"), "decisions: []\n");
      await writeIfMissing(join(root, "data", "overrides.yml"), "overrides: []\n");
      await writeIfMissing(join(root, "data", "taxonomy", "stacks.yml"), taxonomyStacks());
      await writeIfMissing(join(root, "data", "taxonomy", "platforms.yml"), taxonomyPlatforms());
      await writeIfMissing(join(root, "data", "taxonomy", "categories.yml"), taxonomyCategories());
      await writeIfMissing(
        join(root, "data", "taxonomy", "distribution-channels.yml"),
        taxonomyDistribution(),
      );
      await writeIfMissing(
        join(root, "content", "methodology.md"),
        "# Methodology\n\nGrove uses repository metadata as a signal. Human curation decisions control final visibility.\n",
      );
      await writeIfMissing(join(root, ".github", "workflows", "validate-data.yml"), workflowValidate());
      await writeIfMissing(join(root, ".github", "workflows", "import.yml"), workflowImport());
      await writeIfMissing(join(root, ".github", "workflows", "deploy.yml"), workflowDeploy(deploy, framework));
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "app_submission.md"), issueTemplateSubmission());
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.md"), issueTemplateBug());
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "feature_request.md"), issueTemplateFeature());
      await writeIfMissing(join(root, "LICENSE"), licenseMIT(projectName));

      s.stop("Scaffolded");

      // ── 8. git init ────────────────────────────────────────────
      if (initGit) {
        try {
          await runExternal("git", ["init", "-b", "main"], { stdio: "ignore", cwd: root });
          p.log.step("Initialized git repo on `main`");
        } catch {
          p.log.warn("git not found — skipping git init");
        }
      }

      // ── 9. pnpm install ────────────────────────────────────────
      if (installDeps) {
        const installSpinner = p.spinner();
        installSpinner.start("Installing dependencies");
        try {
          await runExternal("pnpm", ["install"], { stdio: "ignore", cwd: root });
          installSpinner.stop("Installed dependencies");
        } catch (err) {
          installSpinner.stop("Install failed");
          p.log.warn(`Run \`pnpm install\` inside ${root} to retry.`);
        }
      }

      p.outro(
        `🌳 ${projectName} is ready at ${root}\n\n` +
          `Next steps:\n` +
          `  cd ${projectDir}\n` +
          `  grove import <awesome-list-url>\n` +
          `  grove build\n`,
      );
    },
  );

// ──────────────────────────────────────────────────────────────────────
// grove import
// ──────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────
// grove analyze
// ──────────────────────────────────────────────────────────────────────
program
  .command("analyze")
  .description("Fetch GitHub metadata and generate data/health.yml.")
  .option("--limit <n>", "limit analyzed items for demos/rate limits", (value) => Number(value))
  .action(async (options: { limit?: number }) => {
    const config = await loadConfig();
    const items = itemsFileSchema.parse(await readYamlFile(config.paths.items));
    const list = "items" in items ? items.items : items;
    const selected = typeof options.limit === "number" ? list.slice(0, options.limit) : list;
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

// ──────────────────────────────────────────────────────────────────────
// grove validate
// ──────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────
// grove build
//
// Build the static site in the current project. Discovers the
// framework by reading the project's package.json (deps on
// @grove-dev/<framework>), then runs the matching build command
// (`astro build`, `next build`, `vite build`).
// ──────────────────────────────────────────────────────────────────────
program
  .command("build")
  .description("Build the static directory in the current project repo.")
  .action(async () => {
    const framework = await detectFramework();
    const cmd = frameworkBuildCommand(framework);
    runExternal(cmd[0], cmd[1], { stdio: "inherit" });
  });

// ──────────────────────────────────────────────────────────────────────
// grove dev
// ──────────────────────────────────────────────────────────────────────
program
  .command("dev")
  .description("Start the framework dev server in the current project repo.")
  .action(async () => {
    const framework = await detectFramework();
    const cmd = frameworkDevCommand(framework);
    runExternal(cmd[0], cmd[1], { stdio: "inherit" });
  });

// ──────────────────────────────────────────────────────────────────────
// grove build-data
// ──────────────────────────────────────────────────────────────────────
program
  .command("build-data")
  .description("Build data/generated/*.json from data/apps/*.yml + curated.config.ts.")
  .action(async () => {
    const result = await buildData();
    console.log(
      `[build-data] ${result.totalApps} full, ${result.visibleApps} visible index\n` +
        `  full:  ${result.fullPath}\n` +
        `  index: ${result.indexPath}\n` +
        `  config: ${result.configTsPath}`,
    );
  });

// ──────────────────────────────────────────────────────────────────────
// grove sitemap
// ──────────────────────────────────────────────────────────────────────
program
  .command("sitemap")
  .description("Generate public/sitemap.xml from data/generated/apps.full.json + curated.config.ts.")
  .action(async () => {
    const config = await loadConfig();
    const appsPath = join(process.cwd(), config.paths.generatedDir, "apps.full.json");
    let payload: { generatedAt?: string; apps?: Array<Record<string, unknown>> };
    try {
      payload = JSON.parse(await readFile(appsPath, "utf8"));
    } catch {
      payload = { apps: [] };
    }
    const items = (payload.apps ?? []) as Array<{
      slug: string;
      name?: string;
      visibility?: string;
      lastCommitAt?: string | null;
      addedAt?: string | null;
    }>;
    const result = await buildSitemap({
      generatedAt: payload.generatedAt ?? new Date().toISOString(),
      items,
    });
    console.log(`[sitemap] wrote ${result.urlCount} URLs → ${result.path}`);
  });

// ──────────────────────────────────────────────────────────────────────
// grove enrich
// ──────────────────────────────────────────────────────────────────────
program
  .command("enrich")
  .description("Enrich data/apps/*.yml with HTML-scrape GitHub metadata (no token required).")
  .option("--limit <n>", "limit enriched apps for rate limits", (value) => Number(value))
  .action(async (options: { limit?: number }) => {
    const config = await loadConfig();
    const appsDir = resolve(process.cwd(), config.paths.appsDir);
    const { readdir } = await import("node:fs/promises");
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
      const raw = parseAppYaml(text, file.replace(/\.yml$/, ""));
      const app = normalizeAppRecord(raw, file.replace(/\.yml$/, ""));
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
      const nextDoc = { ...raw, github: { ...((raw.github as object) ?? {}), repository: next } };
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
// ──────────────────────────────────────────────────────────────────────
program
  .command("review")
  .description("List items that need human curation (cleanup candidates, unknown, etc).")
  .action(async () => {
    const { report, path } = await buildReviewReport();
    console.log(`[review] ${report.totalCandidates} candidate(s) → ${path}`);
    for (const c of report.candidates.slice(0, 10)) {
      console.log(`  - ${c.slug} (${c.status}, ${c.stars}★)`);
    }
  });

// ──────────────────────────────────────────────────────────────────────
// grove build-llms-full
// ──────────────────────────────────────────────────────────────────────
program
  .command("build-llms-full")
  .description("Generate public/llms.txt and public/llms-full.txt from generated apps data.")
  .action(async () => {
    const config = await loadConfig();
    const appsPath = join(process.cwd(), config.paths.generatedDir, "apps.full.json");
    let payload: { generatedAt?: string; apps?: Array<Record<string, unknown>> };
    try {
      payload = JSON.parse(await readFile(appsPath, "utf8"));
    } catch {
      payload = { apps: [] };
    }
    const apps = (payload.apps ?? []) as Array<{
      slug: string;
      name: string;
      description?: string;
      category?: string;
      stack?: string;
      stars?: number;
      visibility?: string;
    }>;
    const result = await buildLlmsFiles({
      generatedAt: payload.generatedAt ?? new Date().toISOString(),
      apps: apps.map((a) => ({
        slug: a.slug,
        name: a.name,
        description: a.description,
        category: a.category,
        stack: a.stack,
        stars: a.stars,
        visibility: a.visibility,
      })),
    });
    console.log(`[build-llms-full] ${result.indexed} indexed → ${result.txtPath} + ${result.fullPath}`);
  });

// ──────────────────────────────────────────────────────────────────────
// Framework discovery + command resolution
// ──────────────────────────────────────────────────────────────────────

async function detectFramework(): Promise<Framework> {
  try {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (all["@grove-dev/astro"]) return "astro";
    if (all["@grove-dev/nextjs"]) return "nextjs";
    if (all["@grove-dev/svelte"]) return "svelte";
  } catch {
    /* ignore */
  }
  console.error("Could not detect a Grove framework in the current project.");
  console.error("Install @grove-dev/astro, @grove-dev/nextjs, or @grove-dev/svelte first.");
  process.exit(1);
}

function frameworkBuildCommand(fw: Framework): [string, string[]] {
  switch (fw) {
    case "astro":
      return ["pnpm", ["exec", "astro", "build"]];
    case "nextjs":
      return ["pnpm", ["exec", "next", "build"]];
    case "svelte":
      return ["pnpm", ["exec", "vite", "build"]];
  }
}

function frameworkDevCommand(fw: Framework): [string, string[]] {
  switch (fw) {
    case "astro":
      return ["pnpm", ["exec", "astro", "dev"]];
    case "nextjs":
      return ["pnpm", ["exec", "next", "dev"]];
    case "svelte":
      return ["pnpm", ["exec", "vite", "dev"]];
  }
}

function runExternal(
  bin: string,
  args: string[],
  opts: { stdio?: "inherit" | "ignore"; cwd?: string } = {},
): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(bin, args, {
      stdio: opts.stdio ?? "inherit",
      cwd: opts.cwd,
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${bin} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

// ──────────────────────────────────────────────────────────────────────
// Templated project files (these stay in the CLI; they're emitted
// per-project and have nothing to do with the framework adapter).
// ──────────────────────────────────────────────────────────────────────

async function resolveText(
  message: string,
  fallback: string,
  placeholder?: string,
): Promise<string> {
  const result = await p.text({
    message,
    placeholder,
    defaultValue: fallback,
    validate: (value) => {
      if (!value || value.trim().length === 0) return `${message} is required`;
    },
  });
  if (p.isCancel(result)) {
    p.cancel("Aborted.");
    process.exit(0);
  }
  return String(result);
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, "utf8");
  } catch {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
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

function projectReadme(projectName: string, framework: Framework): string {
  return `# ${projectName}

A living, health-aware developer directory built with [Grove](https://github.com/tortuvshin/grove).

Framework: **${framework}**

## What this is

This repository is **data + branding + decisions**, not the framework.
The CLI and static framework live in the separate \`grove\` repo.

## Workflow

\`\`\`bash
grove import <source>
grove analyze
grove review
grove validate
grove build-data
grove build-llms-full
grove sitemap
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
`;
}

function gitignoreTemplate(): string {
  return `node_modules/
dist/
.astro/
.next/
.svelte-kit/
.DS_Store
.env
.env.*
!.env.example
data/.cache/
data/generated/
coverage/
.tmp-test/
.idea/
.vscode/
*.log
*.tsbuildinfo
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

function workflowImport(): string {
  return `name: Refresh data

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Refresh items
        run: |
          grove import "$AWESOME_SOURCE"
          grove analyze
          grove review
          grove build-data
          grove build-llms-full
          grove sitemap
        env:
          AWESOME_SOURCE: \${{ vars.AWESOME_SOURCE }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - name: Open PR
        uses: peter-evans/create-pull-request@v6
        with:
          title: "chore(data): refresh from upstream"
          commit-message: "chore(data): refresh from upstream"
          branch: chore/data-refresh
`;
}

function workflowDeploy(provider: DeployProvider, framework: Framework): string {
  switch (provider) {
    case "vercel":
      return `name: Deploy to Vercel
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./
`;
    case "netlify":
      return `name: Deploy to Netlify
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: nwtgck/actions-netlify@v3.0
        with:
          publish-dir: ./dist
          production-deploy: true
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
`;
    case "cloudflare":
      return `name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${framework}-site
          directory: dist
`;
    case "github-pages":
      return `name: Build & deploy to GitHub Pages
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
        with: { node-version: "20", cache: pnpm }
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
    case "none":
      return `# No deploy workflow generated. Add your own when ready.`;
  }
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

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
