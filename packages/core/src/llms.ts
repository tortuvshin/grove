import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type GroveConfig, loadConfig } from "./config.js";
import { slugify } from "./slug.js";

export interface LlmsRecordInput {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  stack?: string;
  stars?: number;
  visibility?: string;
  detail?: string;
  homepageUrl?: string;
  repoUrl?: string;
  license?: string;
  lastCommitAt?: string | null;
  addedAt?: string | null;
}

export interface LlmsInput {
  siteUrl?: string;
  generatedAt: string;
  records: LlmsRecordInput[];
}

export interface LlmsResult {
  txtPath: string;
  fullPath: string;
  indexed: number;
}

const BLUEPRINT_INDEX: Record<string, string> = {
  "project-directory": "projects",
  "resource-hub": "resources",
  "ecosystem-map": "entities",
};

const BLUEPRINT_PLURAL: Record<string, string> = {
  "project-directory": "Projects",
  "resource-hub": "Resources",
  "ecosystem-map": "Entities",
};

function directorySlug(config: GroveConfig): string {
  return config.routes.directory ?? BLUEPRINT_INDEX[config.blueprint] ?? "items";
}

function pluralLabel(config: GroveConfig): string {
  const label = config.labels.plural ?? BLUEPRINT_PLURAL[config.blueprint] ?? "Items";
  return label.replace(/^./, (value) => value.toUpperCase());
}

function slug(value: string): string {
  // Delegate to the package's single public slugifier. llms.txt anchor
  // links only need the base form (no collision counter), and the
  // public `slugify` matches the GitHub-flavored anchor format the
  // downstream Markdown renderer expects.
  return slugify(String(value));
}

function truncate(value: string, max: number): string {
  return value.replace(/\s+/g, " ").slice(0, max);
}

function buildIndexLine(record: LlmsRecordInput): string {
  const desc = truncate(record.description ?? "", 120);
  const cat = record.category ?? "—";
  const stack = record.stack ?? "—";
  const stars = record.stars ?? 0;
  return `- [${record.name}](#${slug(record.slug)}) — ${cat} · ${stack} · ${stars}★ — ${desc}`;
}

function buildDetailSection(
  record: LlmsRecordInput,
  siteUrl: string,
  indexSlug: string,
): string {
  const lines: string[] = [
    `### ${record.name}`,
    "",
    record.description ? `${record.description}` : "",
    "",
    `- slug: ${record.slug}`,
    `- category: ${record.category ?? "—"}`,
    `- stack: ${record.stack ?? "—"}`,
    `- stars: ${record.stars ?? 0}`,
    record.license ? `- license: ${record.license}` : "",
    record.repoUrl ? `- repo: ${record.repoUrl}` : "",
    record.homepageUrl ? `- homepage: ${record.homepageUrl}` : "",
    `- url: ${siteUrl}/${indexSlug}/${record.slug}`,
    record.lastCommitAt ? `- lastCommit: ${record.lastCommitAt.slice(0, 10)}` : "",
    record.addedAt ? `- added: ${record.addedAt.slice(0, 10)}` : "",
  ].filter(Boolean);
  if (record.detail) {
    lines.push("", "#### Detail", "", record.detail);
  }
  return lines.join("\n");
}

export function buildLlmsTxt(input: LlmsInput, config: GroveConfig): string {
  const siteUrl = (input.siteUrl ?? config.site.url ?? "").replace(/\/$/, "");
  const indexSlug = directorySlug(config);
  const visible = input.records.filter(
    (r) => r.visibility !== "hide" && r.visibility !== "remove",
  );
  return `# ${config.site.name}

${config.site.description ?? config.site.tagline}

Directory: ${siteUrl}/${indexSlug}
Records indexed: ${visible.length}
Categories: ${new Set(visible.map((r) => r.category).filter(Boolean)).size}

## Usage

Use /llms-full.txt for record-level details. Prefer detail pages for citations.
`;
}

export function buildLlmsFullTxt(input: LlmsInput, config: GroveConfig): string {
  const siteUrl = (input.siteUrl ?? config.site.url ?? "").replace(/\/$/, "");
  const indexSlug = directorySlug(config);
  const visible = input.records.filter(
    (r) => r.visibility !== "hide" && r.visibility !== "remove",
  );
  const plural = pluralLabel(config);
  const index = visible.map(buildIndexLine).join("\n");
  const sections = visible
    .map((record) => buildDetailSection(record, siteUrl, indexSlug))
    .join("\n\n");
  return [
    `# ${config.site.name} — full directory`,
    "",
    `> Generated ${input.generatedAt} from ${input.records.length} records.`,
    `> Source: ${siteUrl}/${indexSlug} · Regenerate with \`grove generate\`.`,
    "",
    "Each section below mirrors one record detail page.",
    "",
    "## Index",
    "",
    index,
    "",
    sections ? `## ${plural}` : "",
    "",
    sections,
    "",
  ].join("\n");
}

export async function buildLlmsFiles(
  input: LlmsInput,
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<LlmsResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const publicDir = resolve(cwd, cfg.paths.publicDir);
  await mkdir(publicDir, { recursive: true });
  const txtPath = join(publicDir, "llms.txt");
  const fullPath = join(publicDir, "llms-full.txt");
  await writeFile(txtPath, buildLlmsTxt(input, cfg), "utf8");
  await writeFile(fullPath, buildLlmsFullTxt(input, cfg), "utf8");
  return {
    txtPath,
    fullPath,
    indexed: input.records.filter(
      (r) => r.visibility !== "hide" && r.visibility !== "remove",
    ).length,
  };
}
