import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type CuratedConfig, loadConfig } from "./config.js";

export interface LlmsAppInput {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  stack?: string;
  stars?: number;
  visibility?: string;
  /** Detail page body — markdown. Used for llms-full.txt sections. */
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
  apps: LlmsAppInput[];
}

export interface LlmsResult {
  txtPath: string;
  fullPath: string;
  indexed: number;
}

function slug(value: string): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function truncate(value: string, max: number): string {
  return value.replace(/\s+/g, " ").slice(0, max);
}

function buildIndexLine(app: LlmsAppInput): string {
  const desc = truncate(app.description ?? "", 120);
  const cat = app.category ?? "—";
  const stack = app.stack ?? "—";
  const stars = app.stars ?? 0;
  return `- [${app.name}](#${slug(app.slug)}) — ${cat} · ${stack} · ${stars}★ — ${desc}`;
}

function buildDetailSection(app: LlmsAppInput, siteUrl: string, indexSlug: string): string {
  const lines: string[] = [
    `### ${app.name}`,
    "",
    app.description ? `${app.description}` : "",
    "",
    `- slug: ${app.slug}`,
    `- category: ${app.category ?? "—"}`,
    `- stack: ${app.stack ?? "—"}`,
    `- stars: ${app.stars ?? 0}`,
    app.license ? `- license: ${app.license}` : "",
    app.repoUrl ? `- repo: ${app.repoUrl}` : "",
    app.homepageUrl ? `- homepage: ${app.homepageUrl}` : "",
    `- url: ${siteUrl}/${indexSlug}/${app.slug}`,
    app.lastCommitAt ? `- lastCommit: ${app.lastCommitAt.slice(0, 10)}` : "",
    app.addedAt ? `- added: ${app.addedAt.slice(0, 10)}` : "",
  ].filter(Boolean);
  if (app.detail) {
    lines.push("", "#### Detail", "", app.detail);
  }
  return lines.join("\n");
}

/** Build the llms.txt string — short pointer to llms-full.txt. */
export function buildLlmsTxt(input: LlmsInput, config: CuratedConfig): string {
  const siteUrl = (input.siteUrl ?? config.siteUrl ?? "").replace(/\/$/, "");
  const visible = input.apps.filter((a) => a.visibility !== "hide" && a.visibility !== "remove");
  const indexSlug = config.itemLabel === "app" ? "apps" : "projects";
  return `# ${config.name}

${config.description ?? config.tagline}

Directory: ${siteUrl}/${indexSlug}
Projects indexed: ${visible.length}
Categories: ${new Set(visible.map((a) => a.category).filter(Boolean)).size}

## Usage

Use /llms-full.txt for project-level details. Prefer project detail pages for citations.
`;
}

/** Build the llms-full.txt string — index + per-app sections. */
export function buildLlmsFullTxt(input: LlmsInput, config: CuratedConfig): string {
  const siteUrl = (input.siteUrl ?? config.siteUrl ?? "").replace(/\/$/, "");
  const indexSlug = config.itemLabel === "app" ? "apps" : "projects";
  const visible = input.apps.filter((a) => a.visibility !== "hide" && a.visibility !== "remove");
  const index = visible.map(buildIndexLine).join("\n");
  const sections = visible
    .map((app) => buildDetailSection(app, siteUrl, indexSlug))
    .join("\n\n");
  return [
    `# ${config.name} — full directory`,
    "",
    `> Generated ${input.generatedAt} from ${input.apps.length} app records.`,
    `> Source: ${siteUrl}/${indexSlug} · Regenerate with \`grove build-llms-full\`.`,
    "",
    "Each section below mirrors one app detail page.",
    "",
    "## Index",
    "",
    index,
    "",
    sections ? "## Projects" : "",
    "",
    sections,
    "",
  ].join("\n");
}

/** Write public/llms.txt and public/llms-full.txt. */
export async function buildLlmsFiles(
  input: LlmsInput,
  cwd = process.cwd(),
  config?: CuratedConfig,
): Promise<LlmsResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const publicDir = resolve(cwd, "public");
  await mkdir(publicDir, { recursive: true });
  const txtPath = join(publicDir, "llms.txt");
  const fullPath = join(publicDir, "llms-full.txt");
  await writeFile(txtPath, buildLlmsTxt(input, cfg), "utf8");
  await writeFile(fullPath, buildLlmsFullTxt(input, cfg), "utf8");
  return {
    txtPath,
    fullPath,
    indexed: input.apps.filter((a) => a.visibility !== "hide" && a.visibility !== "remove").length,
  };
}
