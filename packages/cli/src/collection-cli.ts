import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify as yamlStringify } from "yaml";

export function buildCollectionCommand(): Command {
  const cmd = new Command("collection");
  cmd.description("Curated collection management");

  cmd
    .command("promote")
    .description("Promote a filter URL to a curated collection YAML.")
    .requiredOption("--from <path>", "Source filter path, e.g. /browse?stack=flutter&category=finance")
    .requiredOption("--slug <slug>", "Slug for the new collection")
    .option("--title <title>", "Title")
    .option("--description <description>", "Description")
    .action(async (opts) => {
      const params = parseQuery(opts.from);
      const collection = {
        slug: opts.slug,
        kind: "curated",
        title: opts.title ?? humanize(opts.slug),
        description: opts.description ?? `Curated collection built from ${opts.from}.`,
        query: {
          ...(params.stack ? { stacks: [params.stack] } : {}),
          ...(params.category ? { categories: [params.category] } : {}),
          ...(params.platform ? { platforms: [params.platform] } : {}),
          excludeStatuses: ["archived"],
        },
        ranking: { preset: "quality" },
        seo: { index: true },
      };
      const out = resolve(process.cwd(), "data/collections", `${opts.slug}.yml`);
      await mkdir(resolve(process.cwd(), "data/collections"), { recursive: true });
      await writeFile(out, yamlStringify(collection), "utf8");
      process.stdout.write(`Wrote ${out}\n`);
    });

  return cmd;
}

function parseQuery(path: string): Record<string, string> {
  const [, search = ""] = path.split("?");
  const out: Record<string, string> = {};
  for (const pair of search.split("&")) {
    const [k, v] = pair.split("=");
    if (k && v !== undefined) out[k] = decodeURIComponent(v);
  }
  return out;
}

function humanize(slug: string): string {
  return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}
