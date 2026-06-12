#!/usr/bin/env node
/**
 * Grove CLI — scaffolds Grove-powered spaces and orchestrates
 * `@grove-dev/core` commands.
 *
 * V1 command surface:
 *   grove new <name>      scaffold a new project (asks blueprint + framework)
 *   grove run [action]    dev-internal: scaffold from LOCAL template and run it
 *                         (dev | build | init). Preserves workspace:* deps.
 *   grove import <src>    turn an awesome list into records/*.yml
 *   grove validate        check records, taxonomy, health, decisions
 *   grove generate        build data/generated/records.{full,index}.json
 *   grove sitemap         write public/sitemap.xml
 *   grove llms            write public/llms.txt and llms-full.txt
 *   grove sync github     optional: enrich records with GitHub metadata
 *   grove cleanup stale   flag records that need human review
 *   grove workflows sync  re-emit GitHub workflow files
 *   grove build           run the framework's build command
 *   grove dev             run the framework's dev server
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  importAwesomeList,
  loadConfig,
  parseGithubRepoUrl,
  stringifyRecordYaml,
  validateProject,
} from "@grove-dev/core";
import { parse as parseYaml } from "yaml";
import {
  copyTemplate,
  ensureDir,
  findMonorepoRoot,
  isFramework,
  listTemplates,
  packageNameFromProjectName,
  renameProjectInTemplate,
  renameProjectInTemplatePreserveDeps,
  SUPPORTED_FRAMEWORKS,
  type DeployProvider,
  type Framework,
} from "./template-loader.js";

/**
 * Resolve the CLI's own version. After `tsc` builds, the build script
 * copies `package.json` next to `index.js` so production usage can read
 * it via `import.meta.url`. In dev (`tsx src/index.ts`) we fall back
 * to a `require` of the source `package.json`.
 */
function readOwnVersion(): string {
  // 1) Production: dist/index.js → ./package.json (alongside the built file).
  try {
    const distPkg = createRequire(import.meta.url)("./package.json");
    if (distPkg?.version) return String(distPkg.version);
  } catch {
    /* not built yet — fall through */
  }
  // 2) Dev: src/index.ts → ../../package.json.
  try {
    const srcPkg = createRequire(import.meta.url)("../../package.json");
    if (srcPkg?.version) return String(srcPkg.version);
  } catch {
    /* missing — fall through */
  }
  return "0.0.0-dev";
}

const CLI_VERSION = readOwnVersion();
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
  .version(CLI_VERSION);

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
  .option("-g, --github <mode>", "GitHub workflow mode: none | public (V1: none=private, public=community)")
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
        github?: string;
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
      // "none"     — private/local mode: only validate-data.yml + build.yml
      // "public"   — public GitHub mode: + sync + cleanup + update + issue/PR templates
      let githubMode: "none" | "public";
      if (opts.github && (opts.github === "none" || opts.github === "public")) {
        githubMode = opts.github;
      } else if (opts.github) {
        p.log.error(`Unknown GitHub mode: ${opts.github}.`);
        p.log.info(`Try one of: none | public`);
        process.exit(1);
      } else if (opts.yes) {
        githubMode = "none";
      } else {
        const g = (await p.select({
          message: "GitHub automation mode?",
          options: [
            {
              value: "none",
              label: "none / private",
              hint: "Private or local — no GitHub token, only validate + build",
            },
            {
              value: "public",
              label: "public GitHub metadata",
              hint: "Community sites — syncs stars, contributors, stale records (token-gated)",
            },
          ],
          initialValue: "none",
        })) as "none" | "public";
        if (p.isCancel(g)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        githubMode = g;
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
      // Always-on workflows (safe for both private and public projects)
      await writeIfMissing(join(root, ".github", "workflows", "validate-data.yml"), workflowValidate());
      await writeIfMissing(join(root, ".github", "workflows", "build.yml"), workflowBuild(framework));
      // Issue templates — both modes support a basic set
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "record_submission.md"), issueTemplateSubmission(blueprint));
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "bug_report.md"), issueTemplateBug());
      await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "feature_request.md"), issueTemplateFeature());
      // Public-GitHub-only workflows and templates
      if (githubMode === "public") {
        await writeIfMissing(join(root, ".github", "workflows", "sync-github-metadata.yml"), workflowSyncGithubMetadata());
        await writeIfMissing(join(root, ".github", "workflows", "sync-contributors.yml"), workflowSyncContributors());
        await writeIfMissing(join(root, ".github", "workflows", "cleanup-stale-records.yml"), workflowCleanupStaleRecords());
        await writeIfMissing(join(root, ".github", "workflows", "update-records.yml"), workflowUpdateRecords());
        await writeIfMissing(join(root, ".github", "ISSUE_TEMPLATE", "report-broken-record.md"), issueTemplateBrokenRecord());
        await writeIfMissing(join(root, ".github", "pull_request_template.md"), pullRequestTemplate());
      }
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

      const ghLabel =
        githubMode === "public"
          ? "public GitHub metadata (sync + cleanup + update workflows)"
          : "none / private (only validate + build workflows)";
      p.outro(
        `🌳 ${projectName} is ready at ${root}\n\n` +
          `Blueprint: ${blueprint}\n` +
          `GitHub mode: ${ghLabel}\n\n` +
          `Next steps:\n` +
          `  cd ${projectDir}\n` +
          `  grove validate\n` +
          `  grove generate\n` +
          `  grove build\n`,
      );
    },
  );

// ──────────────────────────────────────────────────────────────────────
// grove run — dev-only "pretend user" smoke test
// ──────────────────────────────────────────────────────────────────────
//
// `grove new` is the production path: it copies the framework template
// into a fresh dir, rewrites `workspace:*` deps to the published
// version, and (optionally) installs + inits git. That's exactly what
// we want for an end user.
//
// `grove run` is the dev / CI-internal path. It does almost the same
// scaffolding, but with two differences that make it useful when
// iterating on the monorepo:
//
//   1. `workspace:*` deps in the scaffolded `package.json` are LEFT
//      ALONE. pnpm resolves those to the local `packages/*` siblings
//      inside the monorepo, so a template change in
//      `packages/astro/templates/default/` is picked up by the next
//      `grove run` without a publish step.
//
//   2. The scaffold lives INSIDE the monorepo, under
//      `<monorepo-root>/.grove/run/<timestamp>/`. `.grove/*` is
//      registered in `pnpm-workspace.yaml`, so `pnpm install --filter`
//      from the monorepo root can resolve `workspace:*` deps against
//      the local `packages/*` siblings.
//
// After scaffolding and (optionally) installing, `grove run` can launch
// the framework dev server in-process. That makes end-to-end smoke
// tests a one-liner:
//
//          grove run dev                # scaffold → install → astro dev
//          grove run build              # scaffold → install → astro build
//          grove run init --no-install  # just scaffold, fix deps manually
//
// V1 only supports `astro` because that's the only framework with a
// real template + peer wiring. `nextjs` and `svelte` are roadmap.
program
  .command("run")
  .argument(
    "[action]",
    "run action: dev (default) | build | init",
    "dev",
  )
  .argument("[name]", "project directory name (default: grove-run-<timestamp>)")
  .description("Scaffold a Grove project from the LOCAL workspace template and run it.")
  .option("-f, --framework <name>", "framework: astro | nextjs | svelte (V1: astro)", "astro")
  .option("-t, --template <name>", "template name", "default")
  .option("-d, --dir <name>", "project directory name (overrides positional name; relative to monorepo root)")
  .option("--no-install", "skip `pnpm install` after scaffolding")
  .option("--no-git", "skip `git init` after scaffolding")
  .option(
    "--port <port>",
    "dev server port (only used by `dev` action; passed to astro dev)",
    (value) => Number(value),
  )
  .action(
    async (
      action: string,
      name: string | undefined,
      opts: {
        framework: string;
        template: string;
        dir?: string;
        install?: boolean;
        git?: boolean;
        port?: number;
      },
    ) => {
      // ── Validate action ────────────────────────────────────────────
      const validActions = ["dev", "build", "init"] as const;
      type RunAction = (typeof validActions)[number];
      if (!(validActions as readonly string[]).includes(action)) {
        p.log.error(`Unknown run action: ${action}.`);
        p.log.info(`Try one of: ${validActions.join(", ")}`);
        process.exit(1);
      }
      const runAction = action as RunAction;

      // ── Validate framework ─────────────────────────────────────────
      if (!isFramework(opts.framework)) {
        p.log.error(`Unknown framework: ${opts.framework}.`);
        p.log.info(`Try one of: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
        process.exit(1);
      }
      const framework = opts.framework;
      if (framework !== "astro") {
        p.log.warn(
          `Framework "${framework}" is roadmap-only in V1. Only astro has a real template — proceeding anyway and hoping for the best.`,
        );
      }

      p.intro(`🧪 Grove run — ${runAction}`);

      // ── Locate the monorepo root ───────────────────────────────────
      // We need the monorepo root so we can:
      //   (a) decide where to put the scaffolded project (always
      //       inside the monorepo, under `.grove/run/<stamp>/`)
      //   (b) run `pnpm install --filter` from there, so the
      //       workspace protocol resolves `packages/*` siblings.
      const cliLocation = dirname(fileURLToPath(import.meta.url));
      let monorepoRoot: string;
      try {
        monorepoRoot = findMonorepoRoot(cliLocation);
      } catch (err) {
        p.log.error((err as Error).message);
        process.exit(1);
      }
      p.log.info(`Monorepo root: ${monorepoRoot}`);

      // ── Resolve target directory ───────────────────────────────────
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\..+$/, "")
        .replace("T", "-");
      const dirRel = opts.dir ?? name ?? `grove-run-${stamp}`;
      // Always live under <monorepo-root>/.grove/run/<name>/ so the
      // workspace picks it up via the `.grove/*` glob in
      // `pnpm-workspace.yaml`.
      const root = resolve(monorepoRoot, ".grove", "run", dirRel);
      // The dir name and the package.json `name` are not the same —
      // `renameProjectInTemplatePreserveDeps` slugifies the dir name
      // and appends `-<framework>-<template>`. We need the package
      // name to drive `pnpm --filter`, so compute it once and reuse.
      const projectName = root.split("/").filter(Boolean).pop() ?? dirRel;

      // ── Look up the LOCAL template via @grove-dev/<framework>'s
      //    `templates/<name>` directory. Inside this monorepo, that
      //    is a symlink straight to packages/astro/templates/default/,
      //    so a template change in the source tree flows through to
      //    the scaffolded project with no publish step. ─────────────
      const templates = await listTemplates(framework);
      const tpl = templates.find((t) => t.template === opts.template) ?? templates[0];
      if (!tpl) {
        p.log.error(`No templates found for ${framework}.`);
        process.exit(1);
      }
      p.log.info(`Template: ${tpl.path}`);

      const packageName = packageNameFromProjectName(projectName, framework, tpl.template);
      p.log.info(`Project: ${projectName} (package: ${packageName}) → ${root}`);

      // ── Scaffold (or reuse an existing scaffold) ──────────────────
      // If the target dir already contains a package.json whose
      // name matches what we would have written, treat it as a
      // re-run of `grove run dev` against an already-initialised
      // project and skip the copy. That makes iterative development
      // a one-line affair: edit template, run `grove run dev` again.
      const sentinel = join(root, "package.json");
      let alreadyScaffolded = false;
      try {
        const existing = JSON.parse(await readFile(sentinel, "utf8")) as { name?: string };
        const expectedName = packageNameFromProjectName(projectName, framework, tpl.template);
        alreadyScaffolded = existing.name === expectedName;
      } catch {
        alreadyScaffolded = false;
      }
      const s = p.spinner();
      if (alreadyScaffolded) {
        s.start("Reusing existing scaffold");
        s.stop("Reusing existing scaffold");
      } else {
        s.start("Scaffolding");
        await mkdir(root, { recursive: true });
        await copyTemplate(framework, root, tpl.template);
        // `renameProjectInTemplatePreserveDeps` only updates the
        // package.json `name` field — it does NOT touch `workspace:*`
        // Grove deps. The monorepo-root `pnpm install --filter` below
        // then resolves those against the local `packages/*` siblings.
        await renameProjectInTemplatePreserveDeps(framework, root, projectName, tpl.template);
        s.stop("Scaffolded (workspace:* deps preserved)");
      }

      // ── git init ───────────────────────────────────────────────────
      if (opts.git !== false) {
        try {
          await runExternal("git", ["init", "-b", "main"], { stdio: "ignore", cwd: root });
          p.log.step("Initialized git repo on `main`");
        } catch {
          p.log.warn("git not found — skipping git init");
        }
      }

      // ── pnpm install (from monorepo root, scoped to this project) ──
      if (opts.install !== false) {
        const installSpinner = p.spinner();
        installSpinner.start(
          `Installing dependencies (monorepo filter on '${packageName}')`,
        );
        try {
          await runExternal("pnpm", ["install", "--filter", packageName], {
            stdio: "ignore",
            cwd: monorepoRoot,
          });
          installSpinner.stop("Installed dependencies");
        } catch {
          installSpinner.stop("Install failed");
          p.log.warn(
            `Run \`pnpm install --filter ${packageName}\` from ${monorepoRoot} to retry.`,
          );
          if (runAction !== "init") {
            p.log.error("Cannot continue without a working install.");
            process.exit(1);
          }
        }
      }

      // ── Run the requested action ───────────────────────────────────
      if (runAction === "init") {
        p.outro(
          `🌳 Scaffolded at ${root}\n\n` +
            `Next steps:\n` +
            `  cd ${root}\n` +
            `  pnpm dev\n`,
        );
        return;
      }

      if (runAction === "build") {
        // Run the template's `build` script, not `astro build` directly.
        // The script chains `build:data` + `build:sitemap` + `build:llms`
        // + `astro build` so the data is generated first. Skipping that
        // chain gives you a half-built site with no records.
        p.log.step(`Building ${packageName} via 'pnpm run build' (this can take a while)…`);
        await runExternal("pnpm", ["--filter", packageName, "run", "build"], {
          stdio: "inherit",
          cwd: monorepoRoot,
        });
        p.outro(`🌳 Build done at ${root}`);
        return;
      }

      // runAction === "dev" — start the dev server in-process.
      //
      // The template's `dev` script chains `build:data && astro dev`,
      // which is what we want for a production user. But for a dev
      // smoke test, the script's `&&` makes pnpm's `--` forwarding
      // land in a tricky place: `pnpm run dev -- --port 4327` becomes
      // `astro dev -- --port 4327`, where Astro treats `--port 4327`
      // as positional args (port flag ignored).
      //
      // Cleanest workaround: run `build:data` separately (the only
      // pre-step `dev` does), then `pnpm exec astro dev` directly with
      // the port flag in the right place. Two `runExternal` calls is
      // fine — they're both fast (`build:data` is a quick
      // `grove generate`, and `astro dev` is what the user actually
      // wants to see).
      const port = typeof opts.port === "number" ? opts.port : 4321;
      p.log.step(`Generating data via 'pnpm run build:data'…`);
      try {
        await runExternal(
          "pnpm",
          ["--filter", packageName, "run", "build:data"],
          { stdio: "inherit", cwd: monorepoRoot },
        );
      } catch {
        p.log.warn(
          `build:data failed — starting astro dev anyway, site will be empty.`,
        );
      }
      p.log.step(`Starting astro dev on port ${port} (Ctrl-C to stop)…`);
      await runExternal(
        "pnpm",
        ["--filter", packageName, "exec", "astro", "dev", "--port", String(port)],
        { stdio: "inherit", cwd: monorepoRoot },
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
  .option("--strict", "fail on warnings as well as errors")
  .action(async (opts: { strict?: boolean }) => {
    const config: GroveConfig = await loadConfig();
    const result = await validateProject(config, { strict: opts.strict });
    for (const issue of result.errors) {
      console.log(`✖ ${issue.code}: ${issue.message}`);
    }
    for (const issue of result.warnings) {
      console.log(`⚠ ${issue.code}: ${issue.message}`);
    }
    if (!result.ok) {
      process.exitCode = 1;
      const total = result.issues.length;
      const errorCount = result.errors.length;
      const warnCount = result.warnings.length;
      console.log(
        `Validation failed with ${errorCount} error(s) and ${warnCount} warning(s) (${total} total).`,
      );
      return;
    }
    if (result.warnings.length > 0) {
      console.log(
        `Validation passed with ${result.warnings.length} warning(s).`,
      );
    } else {
      console.log("Validation passed.");
    }
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
  .option("--strict", "fail on unavailable GitHub metadata")
  .action(async (target: string, options: { limit?: number; strict?: boolean }) => {
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
    let htmlOnly = 0;
    let failed = 0;
    for (const file of selected) {
      const path = join(recordsDir, file);
      const text = await readFile(path, "utf8");
      const raw = (parseYaml(text) ?? {}) as Record<string, unknown>;
      // Canonical repo URL: `repoUrl` first (the project-directory
      // canonical field per the schema), then fall back to
      // `links.github` for sites that only use the human-facing link.
      // When both are present and disagree, warn loudly — a curator
      // who updated only `links.github` and forgot `repoUrl` would
      // otherwise see stale metadata with no explanation.
      const links = (raw.links as Record<string, string> | undefined) ?? {};
      const rawRepoUrl = raw.repoUrl as string | undefined;
      const linksGithub = links.github;
      if (
        rawRepoUrl &&
        linksGithub &&
        rawRepoUrl.trim() !== linksGithub.trim()
      ) {
        process.stderr.write(
          `[sync github] ${file}: repoUrl "${rawRepoUrl}" and links.github "${linksGithub}" disagree — using repoUrl. Update repoUrl (or remove it) to silence this.\n`,
        );
      }
      const repoUrl = rawRepoUrl ?? linksGithub ?? null;
      if (!repoUrl) {
        process.stdout.write(`[sync github] ${file}: no repoUrl or links.github, skipping\n`);
        continue;
      }
      const ref = parseGithubRepoUrl(repoUrl);
      if (!ref) {
        process.stdout.write(`[sync github] ${file}: unparseable repoUrl, skipping\n`);
        continue;
      }
      process.stdout.write(`[sync github] ${ref.owner}/${ref.repo} ... `);

      // Build a github patch. We always either write a real `repository`
      // block (API success), a partial block from HTML (fallback), or
      // skip the file (both fail). The `sync` block records which
      // path the data came from so downstream consumers can tell
      // full metadata from partial.
      const gh = (raw.github as Record<string, unknown> | undefined) ?? {};
      const githubPatch: Record<string, unknown> = {};
      let syncSource: "api" | "html" | null = null;
      try {
        const metadata = await fetchGithubMetadata(ref);
        if (metadata) {
          githubPatch.repository = {
            full_name: metadata.fullName,
            stargazers_count: metadata.stars,
            forks_count: metadata.forks,
            open_issues_count: metadata.openIssues,
            language: metadata.language,
            pushed_at: metadata.pushedAt,
            archived: metadata.archived,
            license: metadata.license
              ? { spdx_id: metadata.license, name: metadata.license }
              : null,
            topics: metadata.topics,
          };
          syncSource = "api";
        }
      } catch {
        // API failed — try HTML fallback below.
      }
      if (syncSource === null) {
        try {
          const enriched = await enrichFromGithubHtml(repoUrl);
          if (!enriched.notFound && !enriched.rateLimited && !enriched.error) {
            githubPatch.html = {
              license: enriched.fields.license,
              language: enriched.fields.language,
              topics: enriched.fields.topics,
              homepage: enriched.fields.homepage,
            };
            syncSource = "html";
            htmlOnly++;
          }
        } catch {
          // both API and HTML failed
        }
      }
      if (syncSource === null) {
        process.stdout.write("skipped (api+html error)\n");
        failed++;
        continue;
      }
      githubPatch.sync = {
        syncedAt: new Date().toISOString(),
        source: syncSource,
      };
      const next = {
        ...raw,
        github: { ...gh, ...githubPatch },
      };
      await writeFile(path, stringifyRecordYaml(next), "utf8");
      process.stdout.write(syncSource === "api" ? "updated\n" : "html-fallback\n");
      updated++;
    }
    console.log(
      `\n[sync github] ${updated} updated (${htmlOnly} html-only), ${failed} failed`,
    );
    // In strict mode, fail the build if any record could not be synced.
    if (options.strict && failed > 0) {
      process.exitCode = 1;
      console.error(`[sync github] --strict: ${failed} record(s) could not be synced.`);
    }
  });

// ──────────────────────────────────────────────────────────────────────
// grove cleanup stale
// ──────────────────────────────────────────────────────────────────────
program
  .command("cleanup")
  .argument("<target>", "stale")
  .description("List records that need human curation.")
  .option("--report", "produce a report (default behaviour in V1)")
  .option("--strict", "fail the run if any candidates need curation")
  .action(async (target: string, opts: { report?: boolean; strict?: boolean }) => {
    if (target !== "stale") {
      console.error(`Unknown cleanup target: ${target}. Use "stale".`);
      process.exit(1);
    }
    const { report, path } = await cleanupStale();
    console.log(`[cleanup stale] ${report.totalCandidates} candidate(s) → ${path}`);
    for (const c of report.candidates.slice(0, 10)) {
      console.log(`  - ${c.slug} (${c.status}, ${c.stars}★)`);
    }
    if (opts.strict && report.totalCandidates > 0) {
      process.exitCode = 1;
      console.error(
        `[cleanup stale] --strict: ${report.totalCandidates} record(s) need human review.`,
      );
    }
  });

// ──────────────────────────────────────────────────────────────────────
// grove workflows sync
// ──────────────────────────────────────────────────────────────────────
program
  .command("workflows")
  .argument("<action>", "sync")
  .description("Sync Grove workflow templates into the current project.")
  .option("--force", "overwrite existing workflow files")
  .action(async (action: string, opts: { force?: boolean }) => {
    if (action !== "sync") {
      console.error(`Unknown workflows action: ${action}. Use "sync".`);
      process.exit(1);
    }
    const config = await loadConfig();
    // config.integrations.github is the configured GitHub integration mode.
    // `false` → "none" (private); anything else → "public".
    const githubMode: "none" | "public" =
      config.integrations?.github === false || config.integrations?.github === undefined
        ? "none"
        : "public";
    const root = process.cwd();

    // Make sure the directories exist. `ensureDir` returns a
    // promise; without `await`, the subsequent `writeFile` can race
    // the directory creation on cold start.
    await ensureDir(join(root, ".github", "workflows"));
    await ensureDir(join(root, ".github", "ISSUE_TEMPLATE"));

    const files: Array<{ path: string; content: string }> = [
      { path: join(root, ".github", "workflows", "validate-data.yml"), content: workflowValidate() },
      { path: join(root, ".github", "workflows", "build.yml"), content: workflowBuild("astro") },
    ];
    if (githubMode === "public") {
      files.push(
        { path: join(root, ".github", "workflows", "sync-github-metadata.yml"), content: workflowSyncGithubMetadata() },
        { path: join(root, ".github", "workflows", "sync-contributors.yml"), content: workflowSyncContributors() },
        { path: join(root, ".github", "workflows", "cleanup-stale-records.yml"), content: workflowCleanupStaleRecords() },
        { path: join(root, ".github", "workflows", "update-records.yml"), content: workflowUpdateRecords() },
        { path: join(root, ".github", "ISSUE_TEMPLATE", "report-broken-record.md"), content: issueTemplateBrokenRecord() },
        { path: join(root, ".github", "pull_request_template.md"), content: pullRequestTemplate() },
      );
    }

    let written = 0;
    let skipped = 0;
    for (const f of files) {
      if (!opts.force && (await existsLocal(f.path))) {
        skipped++;
        continue;
      }
      await writeFile(f.path, f.content, "utf8");
      written++;
    }
    console.log(
      `[workflows sync] ${githubMode} mode: ${written} written, ${skipped} skipped` +
        (opts.force ? " (--force)" : ""),
    );
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

async function existsLocal(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

# Runs on every PR, every push to main, and on manual dispatch.
# No secrets required — safe for fork PRs.
on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Validate Grove data
        run: pnpm exec grove validate
`;
}

function workflowBuild(framework: Framework): string {
  // The project's "build" script in package.json already chains
  //   grove generate && grove sitemap && grove llms && <framework> build
  // via the `grove` package's own build orchestration. Keep the workflow thin.
  return `name: Build site

# Runs on every PR, every push to main, and on manual dispatch.
# No secrets required — safe for fork PRs.
on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build the site
        run: pnpm build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist
          retention-days: 7
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

function workflowSyncGithubMetadata(): string {
  return `name: Sync GitHub metadata

# Refreshes GitHub repository metadata (stars, forks, last commit, license, …)
# for records that link to public GitHub repos. Runs nightly and on demand.
# Uses GROVE_GITHUB_TOKEN if set, else falls back to GITHUB_TOKEN.
#
# This workflow DOES mutate data/records/*.yml: 'grove sync github' writes
# a 'github.repository' block back into the owning record file. The PR
# below is the human review point for that diff.
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Sync GitHub metadata
        run: pnpm exec grove sync github
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Regenerate Grove data
        run: pnpm exec grove generate

      - name: Open PR with metadata refresh
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/grove-sync-github-metadata
          title: "chore: sync GitHub metadata"
          commit-message: "chore: sync GitHub metadata"
          body: |
            Automated metadata refresh by Grove.

            - Updated GitHub stars, forks, last commit, license, etc.
            - Each touched record YAML now carries a \`github.sync\` block
              with the \`syncedAt\` timestamp and the \`source\` ("api" or
              "html" fallback).
            - Triggered by: \${{ github.event_name }}
          add-paths: |
            data/records/*.yml
            data/generated/*.json
`;
}

function workflowSyncContributors(): string {
  return `name: Sync contributors

# Refreshes contributor data (avatars, recent activity, top contributors)
# for records that have a public GitHub repository. Runs weekly and on demand.
# Uses GROVE_GITHUB_TOKEN if set, else falls back to GITHUB_TOKEN.
on:
  schedule:
    - cron: "0 3 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Sync contributors
        run: pnpm exec grove sync contributors
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Open PR with contributor refresh
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/grove-sync-contributors
          title: "chore: sync contributors"
          commit-message: "chore: sync contributors"
          body: |
            Automated contributor refresh by Grove.

            - Updated contributor lists, avatars, and recent activity.
            - Triggered by: \${{ github.event_name }}
          add-paths: |
            data/generated/contributors.json
            .grove/cache/contributors.json
`;
}

function workflowCleanupStaleRecords(): string {
  return `name: Cleanup stale records

# Reports records that may be outdated, archived, or no longer useful.
# V1 behaviour is REPORT-ONLY — does not delete records. Use --strict in
# the CLI to fail the run if any candidates are flagged.
on:
  schedule:
    - cron: "0 4 * * 0"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  cleanup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate stale-record report
        run: pnpm exec grove cleanup stale
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Open PR with stale-record report
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/grove-stale-record-report
          title: "chore: update stale record report"
          commit-message: "chore: update stale record report"
          body: |
            Automated stale record report by Grove.

            - Records flagged for human review (archived, inactive, broken links, …).
            - Triggered by: \${{ github.event_name }}
          add-paths: |
            data/generated/stale-records.json
            docs/generated/stale-records.md
`;
}

function workflowUpdateRecords(): string {
  return `name: Update Grove records

# Full maintenance cycle: validate + sync GitHub metadata + sync contributors
# + cleanup stale records + regenerate. Run on demand, or weekly if your
# project needs hands-off maintenance.
on:
  workflow_dispatch:
  schedule:
    - cron: "0 5 * * 1"

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  update:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Validate records
        run: pnpm exec grove validate

      - name: Sync GitHub metadata
        run: pnpm exec grove sync github
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Sync contributors
        run: pnpm exec grove sync contributors
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Cleanup stale records
        run: pnpm exec grove cleanup stale
        env:
          GITHUB_TOKEN: \${{ secrets.GROVE_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}

      - name: Regenerate
        run: pnpm exec grove generate

      - name: Open PR with maintenance update
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/grove-update-records
          title: "chore: update Grove records"
          commit-message: "chore: update Grove records"
          body: |
            Automated Grove maintenance update.

            - Validated records
            - Synced GitHub metadata
            - Synced contributors
            - Flagged stale records (report only)
            - Regenerated indexes

            Triggered by: \${{ github.event_name }}
`;
}

function issueTemplateBrokenRecord(): string {
  return `---
name: Report broken record
about: Report a broken link, dead project, wrong category, or duplicate record
title: "[Broken] "
labels: broken-record
---

## Which record is broken?

Record slug (e.g. \`zod\`) or full URL of the record page:

## What is wrong?

- [ ] Broken link (404, dead site, repo not found)
- [ ] Dead / abandoned / archived project
- [ ] Wrong category or tags
- [ ] Duplicate of an existing record
- [ ] Security concern
- [ ] Outdated metadata (stars, last commit, etc.)
- [ ] Incorrect description
- [ ] Other (describe below)

## Details

A short description of the issue, with evidence if possible (link to a working
alternative, archive.org snapshot, or commit history).

## Suggested fix (optional)

If you know what should change, describe it here.
`;
}

function pullRequestTemplate(): string {
  return `## What did you add or change?

<!-- A short summary of your change. -->

## Is this a new record?

- [ ] Yes — adds a new record under \`data/records/\`
- [ ] No — updates an existing record, fixes a bug, or changes infrastructure

## Checklist

- [ ] I added or updated records under \`data/records/\`
- [ ] The record has a clear, accurate description
- [ ] The category and tags are appropriate
- [ ] I ran \`pnpm exec grove validate\` and it passed
- [ ] I did not add generated files manually unless required
- [ ] I included the official / source link where available
- [ ] This PR is safe to publish (no private or sensitive data)
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
