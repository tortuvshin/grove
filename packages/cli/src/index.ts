#!/usr/bin/env node
/**
 * Grove CLI — scaffolds Grove-powered spaces and orchestrates
 * `@grove-dev/core` commands.
 *
 * V1 command surface:
 *   grove new <name>      scaffold a new project (asks blueprint + framework)
 *   grove import <src>    turn an awesome list into records/*.yml
 *   grove validate        check records, taxonomy, health, decisions
 *   grove generate        build data/generated/records.{full,index}.json
 *   grove sitemap         write public/sitemap.xml
 *   grove llms            write public/llms.txt and llms-full.txt
 *   grove sync github     optional: enrich records with GitHub metadata
 *   grove cleanup stale   flag records that need human review
 *   grove build           run the framework's build command
 *   grove dev             run the framework's dev server
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Command } from "commander";
import * as p from "@clack/prompts";
import {
  cleanupStale,
  enrichFromGithubHtml,
  fetchGithubMetadata,
  generate,
  blueprintKind,
  type Blueprint,
  type GroveConfig,
  type HealthEntry,
  type Resource,
  importAwesomeList,
  loadConfig,
  parseGithubRepoUrl,
  stringifyRecordYaml,
  validateProject,
  writeTextFile,
  writeYamlFile,
  type HealthStatus,
  type HealthTier,
  type DecisionVisibility,
  healthFromSignals,
} from "@grove-dev/core";
import { parse as parseYaml } from "yaml";
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
  astro: { label: "Astro", hint: "Static-first, great for content sites (V1 supported)" },
  nextjs: { label: "Next.js", hint: "Roadmap only — not in V1" },
  svelte: { label: "SvelteKit", hint: "Roadmap only — not in V1" },
};
const BLUEPRINT_LABELS: Record<Blueprint, { label: string; hint: string }> = {
  "project-directory": { label: "project-directory", hint: "Structured projects/tools/apps" },
  "resource-hub": { label: "resource-hub", hint: "Guides, comparisons, resources" },
  "ecosystem-map": { label: "ecosystem-map", hint: "Orgs, products, communities" },
};

program
  .name("grove")
  .description("Grove — grow a community knowledge site.")
  .version("0.1.5");

// ──────────────────────────────────────────────────────────────────────
// grove new
// ──────────────────────────────────────────────────────────────────────
program
  .command("new")
  .argument("[name]", "project directory name (current dir if omitted)")
  .description("Scaffold a new Grove project from a framework template.")
  .option("-b, --blueprint <name>", "blueprint: project-directory | resource-hub | ecosystem-map")
  .option("-f, --framework <name>", "framework: astro | nextjs | svelte (V1: astro)")
  .option("-t, --template <name>", "template name", "default")
  .option("-d, --deploy <provider>", `deploy provider: ${DEPLOY_PROVIDERS.join(" | ")}`)
  .option("--no-git", "skip `git init` after scaffolding")
  .option("--no-install", "skip `pnpm install` after scaffolding")
  .option("-y, --yes", "accept defaults for every prompt (CI / scripted use)")
  .action(
    async (
      name: string | undefined,
      opts: {
        blueprint?: string;
        framework?: string;
        template: string;
        deploy?: string;
        git?: boolean;
        install?: boolean;
        yes?: boolean;
      },
    ) => {
      p.intro("🌱 Grow a new Grove space");

      const projectDir: string =
        opts.yes || name ? name ?? "." : await resolveText("Where should the new space live?", ".");
      const projectName: string =
        opts.yes || name
          ? (projectDir === "." ? "Grove Directory" : projectDir)
          : await resolveText("What is the name of this space?", "Grove Directory");

      // Blueprint
      let blueprint: Blueprint;
      const validBlueprints = Object.keys(BLUEPRINT_LABELS) as Blueprint[];
      if (opts.blueprint && (validBlueprints as string[]).includes(opts.blueprint)) {
        blueprint = opts.blueprint as Blueprint;
      } else if (opts.blueprint) {
        p.log.error(`Unknown blueprint: ${opts.blueprint}.`);
        p.log.info(`Try one of: ${validBlueprints.join(", ")}`);
        process.exit(1);
      } else if (opts.yes) {
        blueprint = "project-directory";
      } else {
        const b = await p.select({
          message: "Pick a blueprint",
          options: validBlueprints.map((b) => ({
            value: b,
            label: BLUEPRINT_LABELS[b].label,
            hint: BLUEPRINT_LABELS[b].hint,
          })),
          initialValue: "project-directory",
        });
        if (p.isCancel(b)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        blueprint = b as Blueprint;
      }

      // GitHub integration
      const githubMode: "none" | "public" =
        opts.yes
          ? "none"
          : (await p.select({
              message: "GitHub integration?",
              options: [
                { value: "none", label: "None / private site", hint: "No GitHub token, no API calls" },
                { value: "public", label: "Public GitHub metadata", hint: "Optional, gated by token" },
              ],
              initialValue: "none",
            })) as "none" | "public";
      if (p.isCancel(githubMode)) {
        p.cancel("Aborted.");
        process.exit(0);
      }

      // Framework
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
          message: "Pick a framework (V1 only supports astro)",
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

      const template = opts.template;

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
      const renameResult = await renameProjectInTemplate(
        framework,
        root,
        projectName,
        tpl.template,
      );
      if (renameResult.rewrittenDeps.length > 0) {
        p.log.step(
          `Rewrote workspace deps to published version: ${renameResult.rewrittenDeps.join(", ")}`,
        );
      }

      await Promise.all([
        ensureDir(join(root, "data")),
        ensureDir(join(root, "data", "records")),
        ensureDir(join(root, "data", "taxonomy")),
        ensureDir(join(root, "data", "generated")),
        ensureDir(join(root, "content")),
        ensureDir(join(root, "content", "pages")),
        ensureDir(join(root, "content", "records")),
        ensureDir(join(root, "public")),
        ensureDir(join(root, ".github")),
        ensureDir(join(root, ".github", "ISSUE_TEMPLATE")),
        ensureDir(join(root, ".github", "workflows")),
      ]);
      await writeIfMissing(join(root, "grove.config.ts"), projectConfig(projectName, blueprint, githubMode));
      await writeIfMissing(join(root, "README.md"), projectReadme(projectName, blueprint, framework));
      await writeIfMissing(join(root, ".gitignore"), gitignoreTemplate());
      await writeIfMissing(join(root, "data", "decisions.yml"), "decisions: []\n");
      await writeIfMissing(join(root, "content", "methodology.md"), "# Methodology\n\nGrove uses repository metadata as a signal. Human curation decisions control final visibility.\n");
      await writeIfMissing(join(root, ".github", "workflows", "validate-data.yml"), workflowValidate());
      await writeIfMissing(join(root, ".github", "workflows", "build.yml"), workflowBuild(framework));
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "record_submission.md"), issueTemplateSubmission(blueprint));
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.md"), issueTemplateBug());
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "feature_request.md"), issueTemplateFeature());
      await writeIfMissing(join(root, "LICENSE"), licenseMIT(projectName));

      s.stop("Scaffolded");

      if (initGit) {
        try {
          await runExternal("git", ["init", "-b", "main"], { stdio: "ignore", cwd: root });
          p.log.step("Initialized git repo on `main`");
        } catch {
          p.log.warn("git not found — skipping git init");
        }
      }

      if (installDeps) {
        const installSpinner = p.spinner();
        installSpinner.start("Installing dependencies");
        try {
          await runExternal("pnpm", ["install"], { stdio: "ignore", cwd: root });
          installSpinner.stop("Installed dependencies");
        } catch {
          installSpinner.stop("Install failed");
          p.log.warn(`Run \`pnpm install\` inside ${root} to retry.`);
        }
      }

      p.outro(
        `🌳 ${projectName} is ready at ${root}\n\n` +
          `Blueprint: ${blueprint}\n` +
          `GitHub integration: ${githubMode}\n\n` +
          `Next steps:\n` +
          `  cd ${projectDir}\n` +
          `  grove validate\n` +
          `  grove generate\n` +
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
  .description("Import Markdown links into data/records/*.yml for the current blueprint.")
  .action(async (source: string) => {
    const config = await loadConfig();
    const result = await importAwesomeList(source);
    const recordsDir = resolve(process.cwd(), config.paths.recordsDir);
    await mkdir(recordsDir, { recursive: true });
    const expectedKind = blueprintKind[config.blueprint];
    let written = 0;
    for (const record of result.records) {
      const yamlObj: Record<string, unknown> = {
        kind: expectedKind,
        slug: record.slug,
        description: record.description,
        category: record.category,
        tags: [],
        links: record.links,
        source: { type: "import" },
      };
      if (expectedKind === "project") {
        yamlObj.name = record.name;
      } else if (expectedKind === "resource") {
        yamlObj.title = record.name;
        yamlObj.type = "link";
        yamlObj.topic = record.category;
      } else if (expectedKind === "entity") {
        yamlObj.name = record.name;
        yamlObj.type = "other";
      }
      const path = join(recordsDir, `${record.slug}.yml`);
      await writeFile(path, stringifyRecordYaml(yamlObj), "utf8");
      written++;
    }
    console.log(`Imported ${written} record(s) into ${recordsDir}`);
  });

// ──────────────────────────────────────────────────────────────────────
// grove validate
// ──────────────────────────────────────────────────────────────────────
program
  .command("validate")
  .description("Validate project data files against the configured blueprint.")
  .action(async () => {
    const config: GroveConfig = await loadConfig();
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
// grove generate
// ──────────────────────────────────────────────────────────────────────
program
  .command("generate")
  .description("Build data/generated/records.{full,index}.json from data/records/*.yml.")
  .action(async () => {
    const result = await generate();
    console.log(
      `[generate] ${result.totalRecords} total, ${result.visibleRecords} visible\n` +
        `  full:  ${result.fullPath}\n` +
        `  index: ${result.indexPath}\n` +
        `  alias: ${result.aliasPath}`,
    );
  });

// ──────────────────────────────────────────────────────────────────────
// grove sitemap
// ──────────────────────────────────────────────────────────────────────
program
  .command("sitemap")
  .description("Generate public/sitemap.xml from data/generated/records.full.json.")
  .action(async () => {
    const config = await loadConfig();
    const { buildSitemap } = await import("@grove-dev/core");
    const recordsPath = join(
      process.cwd(),
      config.paths.generatedDir,
      "records.full.json",
    );
    let payload: {
      generatedAt?: string;
      records?: Array<Record<string, unknown>>;
    };
    try {
      payload = JSON.parse(await readFile(recordsPath, "utf8"));
    } catch {
      payload = { records: [] };
    }
    const items = (payload.records ?? []) as Array<{
      slug: string;
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
// grove llms
// ──────────────────────────────────────────────────────────────────────
program
  .command("llms")
  .description("Generate public/llms.txt and public/llms-full.txt.")
  .action(async () => {
    const config = await loadConfig();
    const { buildLlmsFiles } = await import("@grove-dev/core");
    const recordsPath = join(
      process.cwd(),
      config.paths.generatedDir,
      "records.full.json",
    );
    let payload: {
      generatedAt?: string;
      records?: Array<Record<string, unknown>>;
    };
    try {
      payload = JSON.parse(await readFile(recordsPath, "utf8"));
    } catch {
      payload = { records: [] };
    }
    const records = (payload.records ?? []) as Array<{
      slug: string;
      name?: string;
      title?: string;
      description?: string;
      category?: string;
      stack?: string;
      stars?: number;
      visibility?: string;
    }>;
    const result = await buildLlmsFiles({
      generatedAt: payload.generatedAt ?? new Date().toISOString(),
      records: records.map((r) => ({
        slug: r.slug,
        name: r.name ?? r.title ?? r.slug,
        description: r.description,
        category: r.category,
        stack: r.stack,
        stars: r.stars,
        visibility: r.visibility,
      })),
    });
    console.log(`[llms] ${result.indexed} indexed → ${result.txtPath} + ${result.fullPath}`);
  });

// ──────────────────────────────────────────────────────────────────────
// grove sync github
// ──────────────────────────────────────────────────────────────────────
program
  .command("sync")
  .argument("<target>", "github | contributors")
  .description("Optional GitHub integration: enrich records with GitHub metadata.")
  .option("--limit <n>", "limit records to sync (rate-limit guard)", (value) => Number(value))
  .action(async (target: string, options: { limit?: number }) => {
    const config = await loadConfig();
    if (target !== "github" && target !== "contributors") {
      console.error(`Unknown sync target: ${target}. Use "github" or "contributors".`);
      process.exit(1);
    }
    if (target === "contributors") {
      console.log("[sync contributors] contributor sync is not yet implemented in V1.");
      return;
    }
    const recordsDir = resolve(process.cwd(), config.paths.recordsDir);
    const { readdir } = await import("node:fs/promises");
    let entries: string[] = [];
    try {
      entries = await readdir(recordsDir);
    } catch {
      console.error(`[sync github] ${recordsDir} does not exist.`);
      process.exit(1);
    }
    const files = entries.filter((f) => f.endsWith(".yml")).sort();
    const selected =
      typeof options.limit === "number" ? files.slice(0, options.limit) : files;
    let updated = 0;
    let failed = 0;
    for (const file of selected) {
      const path = join(recordsDir, file);
      const text = await readFile(path, "utf8");
      const raw = (parseYaml(text) ?? {}) as Record<string, unknown>;
      const links = (raw.links as Record<string, string> | undefined) ?? {};
      if (!links.github) continue;
      const ref = parseGithubRepoUrl(links.github);
      if (!ref) continue;
      process.stdout.write(`[sync github] ${ref.owner}/${ref.repo} ... `);
      let metadata = null;
      try {
        metadata = await fetchGithubMetadata(ref);
      } catch {
        try {
          const enriched = await enrichFromGithubHtml(links.github);
          if (enriched.fields) {
            process.stdout.write("html-fallback\n");
          }
        } catch {
          process.stdout.write("skipped (api error)\n");
          failed++;
          continue;
        }
      }
      const gh = (raw.github as Record<string, unknown> | undefined) ?? {};
      const next = {
        ...raw,
        github: { ...gh, repository: metadata },
      };
      await writeFile(path, stringifyRecordYaml(next), "utf8");
      process.stdout.write("updated\n");
      updated++;
    }
    console.log(`\n[sync github] ${updated} updated, ${failed} failed`);
  });

// ──────────────────────────────────────────────────────────────────────
// grove cleanup stale
// ──────────────────────────────────────────────────────────────────────
program
  .command("cleanup")
  .argument("<target>", "stale")
  .description("List records that need human curation.")
  .action(async (target: string) => {
    if (target !== "stale") {
      console.error(`Unknown cleanup target: ${target}. Use "stale".`);
      process.exit(1);
    }
    const { report, path } = await cleanupStale();
    console.log(`[cleanup stale] ${report.totalCandidates} candidate(s) → ${path}`);
    for (const c of report.candidates.slice(0, 10)) {
      console.log(`  - ${c.slug} (${c.status}, ${c.stars}★)`);
    }
  });

// ──────────────────────────────────────────────────────────────────────
// grove build / grove dev
// ──────────────────────────────────────────────────────────────────────
program
  .command("build")
  .description("Build the static site in the current project repo.")
  .action(async () => {
    const framework = await detectFramework();
    const cmd = frameworkBuildCommand(framework);
    await runExternal(cmd[0], cmd[1], { stdio: "inherit" });
  });

program
  .command("dev")
  .description("Start the framework dev server in the current project repo.")
  .action(async () => {
    const framework = await detectFramework();
    const cmd = frameworkDevCommand(framework);
    await runExternal(cmd[0], cmd[1], { stdio: "inherit" });
  });

// ──────────────────────────────────────────────────────────────────────
// Framework discovery
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
  console.error("Install @grove-dev/astro first. (Next.js and SvelteKit are roadmap-only in V1.)");
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
// Helper: project file templates
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

function projectConfig(
  projectName: string,
  blueprint: Blueprint,
  githubMode: "none" | "public",
): string {
  const githubIntegrations =
    githubMode === "public"
      ? `integrations: { github: { metadata: true, health: true } },`
      : `integrations: { github: false },`;
  return `import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "${blueprint}",

  site: {
    name: "${projectName}",
    tagline: "A growing community knowledge site.",
  },

  ${githubIntegrations}

  facets: ["category", "tags"],
});
`;
}

function projectReadme(
  projectName: string,
  blueprint: Blueprint,
  framework: Framework,
): string {
  return `# ${projectName}

A growing community knowledge site built with [Grove](https://github.com/tortuvshin/grove).

Blueprint: **${blueprint}** · Framework: **${framework}**

## What this is

This repository is **data + branding + decisions**, not the framework.
The CLI and the renderer live in the \`grove\` repo; you consume them as
\`@grove-dev/core\`, \`@grove-dev/cli\`, and \`@grove-dev/${framework}\`.

## Workflow

\`\`\`bash
grove import <awesome-list-url>     # write data/records/*.yml
grove sync github                   # optional: enrich with GitHub metadata
grove cleanup stale                 # flag records that need human review
grove validate                      # check schemas, slugs, taxonomy
grove generate                      # build data/generated/records.{full,index}.json
grove sitemap                       # write public/sitemap.xml
grove llms                          # write public/llms.txt + llms-full.txt
grove build                         # run the framework's build command
\`\`\`

## Files

- \`grove.config.ts\` — site name, blueprint, integrations, theme, paths.
- \`data/records/\` — per-record YAML (commit this).
- \`data/decisions.yml\` — human curation decisions.
- \`data/generated/\` — auto-generated JSON; do not commit.
- \`content/pages/\` — Markdown pages (\`about.md\`, \`methodology.md\`, ...).
- \`content/records/\` — optional Markdown body per record.
- \`public/\` — logo, OG image, and other static assets.
- \`.github/workflows/\` — validate + build + (optional) sync workflows.
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
data/generated/
coverage/
.tmp-test/
.idea/
.vscode/
*.log
*.tsbuildinfo
`;
}

function workflowValidate(): string {
  return `name: Validate data

on:
  pull_request:
    paths:
      - "data/**"
      - "content/**"
      - "grove.config.ts"
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
      - run: pnpm exec grove validate
`;
}

function workflowBuild(framework: Framework): string {
  const cmd = frameworkBuildCommand(framework);
  return `name: Build

on:
  push:
    branches: [main]
  pull_request:
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
      - run: pnpm exec grove generate
      - run: pnpm exec grove sitemap
      - run: pnpm exec grove llms
      - run: pnpm exec grove build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist
`;
}

function issueTemplateSubmission(blueprint: Blueprint): string {
  const labelHint =
    blueprint === "project-directory"
      ? `- **Repository URL** (required):
- **Name**:
- **One-line description** (≤ 120 chars):
- **Category** (e.g. tools, libraries, frameworks):`
      : blueprint === "resource-hub"
        ? `- **Resource URL** (required):
- **Title**:
- **Type** (guide | comparison | link | explainer | other):
- **Topic**:`
        : `- **Name**:
- **Type** (company | organization | community | school | ...):
- **Category**:
- **Website URL**:`;
  return `---
name: Submit a record
about: Suggest a new record to add to this Grove site
title: "[Submit] "
labels: submission
---

${labelHint}

## Why include it?

A few sentences on what makes this record worth listing.
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
about: Suggest a new feature
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
