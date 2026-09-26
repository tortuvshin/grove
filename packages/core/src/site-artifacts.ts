import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { hostOf } from './host.js';
import { buildRobotsTxt } from './robots.js';
import type { GroveConfig } from './schema.js';

const ROBOTS_MARKER = '# grove-generated: edit this file to take ownership';
const OG_MARKER = '<!-- grove-generated: edit this file to take ownership -->';
const BADGE_MARKER = OG_MARKER;

export interface SiteArtifactStats {
  totalRecords?: number;
  repositoryStars?: number;
}

export interface SiteArtifactsResult {
  robotsPath: string;
  ogImagePath: string;
  robotsWritten: boolean;
  ogImageWritten: boolean;
  /** `public/badges/featured.svg` and `featured-dark.svg`. */
  badgePaths: string[];
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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

export function buildOgImageSvg(config: GroveConfig, stats: SiteArtifactStats = {}): string {
  const title = xml(config.site.name);
  const lines = wrapText(config.site.tagline).map(xml);
  // Neutral accent when no brand color is configured (the OG canvas
  // is dark, so a soft light gray reads as the brand-agnostic glow).
  const accent = xml(config.theme.primaryColor ?? '#e5e5e5');
  const host = xml(hostOf(config.site.url));
  const plural = xml(config.labels.plural ?? 'items');
  const count = stats.totalRecords ?? 0;
  const stars = stats.repositoryStars ?? 0;
  const metric =
    stars > 0
      ? `${count} ${plural} · ${stars.toLocaleString('en-US')} stars`
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
  ${lines.map((line, index) => `<text x="88" y="${338 + index * 46}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#a1a1aa">${line}</text>`).join('\n  ')}
  <text x="88" y="548" font-family="ui-monospace, monospace" font-size="22" fill="#d4d4d8">${host}</text>
  <text x="1112" y="548" text-anchor="end" font-family="ui-monospace, monospace" font-size="22" fill="${accent}">${xml(metric)}</text>
</svg>
`;
}

/**
 * "Featured on <site>" README badge, 40px tall. Record pages offer it
 * to maintainers with Markdown and HTML snippets; the width follows the
 * site name so long names do not clip.
 */
export function buildFeaturedBadgeSvg(
  siteName: string,
  variant: 'light' | 'dark' = 'light',
): string {
  const name = xml(siteName);
  // ~8.4px per character at 14px semibold, plus the mark and padding.
  const width = Math.max(150, Math.round(42 + siteName.length * 8.4 + 14));
  const c =
    variant === 'dark'
      ? {
          bg: '#18181b',
          border: '#3f3f46',
          mark: '#fafafa',
          tick: '#18181b',
          eyebrow: '#a1a1aa',
          text: '#fafafa',
        }
      : {
          bg: '#ffffff',
          border: '#d4d4d8',
          mark: '#18181b',
          tick: '#fafafa',
          eyebrow: '#71717a',
          text: '#18181b',
        };
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  return `${BADGE_MARKER}
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="Featured on ${name}">
  <title>Featured on ${name}</title>
  <rect x="0.5" y="0.5" width="${width - 1}" height="39" rx="8" fill="${c.bg}" stroke="${c.border}"/>
  <rect x="12" y="10" width="20" height="20" rx="4" fill="${c.mark}"/>
  <path d="M17.5 20.5l2.5 2.5 5-6" fill="none" stroke="${c.tick}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="42" y="17" font-family="${font}" font-size="9" font-weight="500" fill="${c.eyebrow}" letter-spacing=".6">FEATURED ON</text>
  <text x="42" y="31" font-family="${font}" font-size="14" font-weight="600" fill="${c.text}">${name}</text>
</svg>
`;
}

async function writeOwnedArtifact(path: string, marker: string, content: string): Promise<boolean> {
  try {
    const current = await readFile(path, 'utf8');
    if (!current.includes(marker)) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return true;
}

export async function buildSiteArtifacts(
  cwd: string,
  config: GroveConfig,
  stats: SiteArtifactStats = {},
): Promise<SiteArtifactsResult> {
  const publicDir = resolve(cwd, config.paths.publicDir);
  const robotsPath = join(publicDir, 'robots.txt');
  const ogImagePath = join(publicDir, 'og-image.svg');
  const robotsWritten = await writeOwnedArtifact(
    robotsPath,
    ROBOTS_MARKER,
    `${ROBOTS_MARKER}\n${buildRobotsTxt({
      siteUrl: config.site.url ?? '',
      // /submit/ is the only noindex page worth keeping crawlers out
      // of — everything else on a Grove site is meant to be indexed.
      disallow: ['/submit/'],
    })}`,
  );
  const ogImageWritten = await writeOwnedArtifact(
    ogImagePath,
    OG_MARKER,
    buildOgImageSvg(config, stats),
  );
  const badgeLight = join(publicDir, 'badges', 'featured.svg');
  const badgeDark = join(publicDir, 'badges', 'featured-dark.svg');
  const badgePaths = [badgeLight, badgeDark];
  await writeOwnedArtifact(
    badgeLight,
    BADGE_MARKER,
    buildFeaturedBadgeSvg(config.site.name, 'light'),
  );
  await writeOwnedArtifact(
    badgeDark,
    BADGE_MARKER,
    buildFeaturedBadgeSvg(config.site.name, 'dark'),
  );
  return { robotsPath, ogImagePath, robotsWritten, ogImageWritten, badgePaths };
}
