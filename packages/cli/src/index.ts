#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Command } from "commander";
import {
  classifyHealth,
  fetchGithubMetadata,
  importAwesomeList,
  itemsFileSchema,
  loadConfig,
  parseGithubRepoUrl,
  readYamlFile,
  unwrapItems,
  validateProject,
  writeTextFile,
  writeYamlFile,
  type CuratedConfig,
  type HealthEntry,
} from "@open-curated/core";

const program = new Command();

program
  .name("open-curated")
  .description("Turn awesome lists into living, health-aware developer directories.")
  .version("0.1.0");

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

function projectConfig(projectName: string): string {
  return `import { defineConfig } from "@open-curated/core";

export default defineConfig({
  name: "${projectName}",
  tagline: "A living, health-aware developer directory.",
  itemLabel: "project",
});
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

program
  .command("init")
  .argument("[name]", "project directory name", ".")
  .description("Create a file-based Open Curated project wrapper.")
  .action(async (name: string) => {
    const root = resolve(name);
    const projectName = name === "." ? "Open Curated Directory" : name;
    await mkdir(root, { recursive: true });
    await Promise.all([
      mkdir(join(root, "sources"), { recursive: true }),
      mkdir(join(root, "data"), { recursive: true }),
      mkdir(join(root, "content"), { recursive: true }),
      mkdir(join(root, "public"), { recursive: true }),
    ]);
    await writeIfMissing(join(root, "curated.config.ts"), projectConfig(projectName));
    await writeIfMissing(join(root, "data", "items.yml"), "items: []\n");
    await writeIfMissing(join(root, "data", "decisions.yml"), "decisions: []\n");
    await writeIfMissing(
      join(root, "content", "methodology.md"),
      "# Methodology\n\nOpen Curated uses repository metadata as a signal. Human curation decisions control final visibility.\n",
    );
    await writeIfMissing(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          type: "module",
          private: true,
          scripts: {
            import: "open-curated import",
            analyze: "open-curated analyze",
            validate: "open-curated validate",
            build: "astro build",
            preview: "astro preview",
          },
          dependencies: {
            "@open-curated/core": "^0.1.0",
            "@open-curated/astro": "^0.1.0",
            astro: "^6.4.4",
          },
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`Created Open Curated project at ${root}`);
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

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
