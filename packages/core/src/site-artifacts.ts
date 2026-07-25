import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { buildRobotsTxt } from "./robots.js";
import type { GroveConfig } from "./schema.js";

const ROBOTS_MARKER = "# grove-generated: edit this file to take ownership";
const OG_MARKER = "<!-- grove-generated: edit this file to take ownership -->";

export interface SiteArtifactStats {
  totalRecords?: number;
  repositoryStars?: number;
}

export interface SiteArtifactsResult {
  robotsPath: string;
  ogImagePath: string;
  robotsWritten: boolean;
  ogImageWritten: boolean;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function displayUrl(rawUrl?: string): string {
  if (!rawUrl) return "example.com";
  try {
    return new URL(rawUrl).host;
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function wrapText(value: string, maxLength = 54): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxLength) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines.slice(0, 2);
}

export function buildOgImageSvg(
  config: GroveConfig,
  stats: SiteArtifactStats = {},
): string {
  const title = xml(config.site.name);
  const lines = wrapText(config.site.tagline).map(xml);
  const accent = xml(config.theme.primaryColor);
  const host = xml(displayUrl(config.site.url));
  const plural = xml(config.labels.plural ?? "items");
  const count = stats.totalRecords ?? 0;
  const stars = stats.repositoryStars ?? 0;
  const metric = stars > 0
    ? `${count} ${plural} · ${stars.toLocaleString("en-US")} stars`
    : `${count} ${plural}`;
  return `${OG_MARKER}
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#18181b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="80" r="260" fill="${accent}" opacity="0.18"/>
  <rect x="88" y="88" width="52" height="52" rx="11" fill="${accent}"/>
  <text x="88" y="260" font-family="ui-sans-serif, system-ui, sans-serif" font-size="82" font-weight="700" fill="#fafafa" letter-spacing="-2">${title}</text>
  ${lines.map((line, index) => `<text x="88" y="${338 + index * 46}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#a1a1aa">${line}</text>`).join("\n  ")}
  <text x="88" y="548" font-family="ui-monospace, monospace" font-size="22" fill="#d4d4d8">${host}</text>
  <text x="1112" y="548" text-anchor="end" font-family="ui-monospace, monospace" font-size="22" fill="${accent}">${xml(metric)}</text>
</svg>
`;
}

async function writeOwnedArtifact(
  path: string,
  marker: string,
  content: string,
): Promise<boolean> {
  try {
    const current = await readFile(path, "utf8");
    if (!current.includes(marker)) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}

export async function buildSiteArtifacts(
  cwd: string,
  config: GroveConfig,
  stats: SiteArtifactStats = {},
): Promise<SiteArtifactsResult> {
  const publicDir = resolve(cwd, config.paths.publicDir);
  const robotsPath = join(publicDir, "robots.txt");
  const ogImagePath = join(publicDir, "og-image.svg");
  const robotsWritten = await writeOwnedArtifact(
    robotsPath,
    ROBOTS_MARKER,
    `${ROBOTS_MARKER}\n${buildRobotsTxt({
      siteUrl: config.site.url ?? "",
      disallow: ["/api/", "/internal/", "/preview/"],
    })}`,
  );
  const ogImageWritten = await writeOwnedArtifact(
    ogImagePath,
    OG_MARKER,
    buildOgImageSvg(config, stats),
  );
  return { robotsPath, ogImagePath, robotsWritten, ogImageWritten };
}
