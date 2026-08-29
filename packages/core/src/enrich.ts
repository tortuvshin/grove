/**
 * Enrich GitHub repository metadata from public HTML + shields.io.
 *
 * Used as a token-free fallback when GitHub REST quota is exhausted.
 * Scrapes the public github.com HTML page for license, language,
 * topics, and homepage. Falls back to shields.io for license when
 * the page render doesn't include the standard "X license" link text.
 *
 * The returned shape is compatible with the GitHub REST `repository`
 * block used in `data/records/<slug>.yml` for `kind: project` records,
 * so a subsequent token-backed sync can fill in the rest of the fields.
 */

import { getOwnerRepoFromUrl } from './schema.js';

export interface EnrichedFields {
  license: string | null;
  language: string | null;
  topics: string[];
  homepage: string | null;
}

const HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml',
  'User-Agent': 'grove-enricher',
};

async function fetchHtml(
  owner: string,
  repo: string,
): Promise<{ notFound: true } | { rateLimited: true } | { error: string } | { html: string }> {
  try {
    const res = await fetch(`https://github.com/${owner}/${repo}`, { headers: HEADERS });
    if (res.status === 404) return { notFound: true };
    if (res.status === 429) return { rateLimited: true };
    if (!res.ok) return { error: `${res.status} ${res.statusText}` };
    return { html: await res.text() };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

function extractLicense(html: string): string | null {
  const m =
    html.match(/>([A-Z][A-Z0-9.+-]*-\d(?:\.\d)?)\s+license/i) ||
    html.match(
      />(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|GPL-2\.0|GPL-3\.0|AGPL-3\.0|MPL-2\.0|ISC|Unlicense|0BSD)\s+license/i,
    );
  return m && m[1] ? m[1] : null;
}

async function fetchLicenseViaShields(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://img.shields.io/github/license/${owner}/${repo}`, {
      headers: HEADERS,
    });
    if (!res.ok) return null;
    const svg = await res.text();
    const m = svg.match(/<title>([^<]+)<\/title>/);
    if (!m || !m[1]) return null;
    const id = m[1]
      .trim()
      .replace(/^license:\s*/i, '')
      .trim();
    if (
      !id ||
      id === 'not specified' ||
      id === 'not identifiable by github' ||
      id === 'unknown' ||
      id.toLowerCase().includes('business source')
    ) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

function extractLanguage(html: string): string | null {
  const m = html.match(/class="color-fg-default text-bold mr-1">([^<]+)<\/span>/);
  return m && m[1] ? m[1].trim() : null;
}

function extractTopics(html: string): string[] {
  const matches = html.matchAll(/<a href="\/topics\/[^"]+"[^>]*>([^<]+)<\/a>/g);
  const out: string[] = [];
  for (const m of matches) {
    if (m[1]) {
      const t = m[1].trim();
      if (t) out.push(t);
    }
  }
  return [...new Set(out)];
}

function extractHomepage(html: string): string | null {
  const m = html.match(
    /<a [^>]*href="(https?:\/\/[^"]+)"[^>]*rel="nofollow"[^>]*>\s*Homepage\s*<\/a>/,
  );
  return m && m[1] ? m[1] : null;
}

export interface EnrichResult {
  fields: EnrichedFields;
  notFound?: boolean;
  rateLimited?: boolean;
  error?: string;
}

export async function enrichFromGithubHtml(repoUrl: string): Promise<EnrichResult> {
  const ref = getOwnerRepoFromUrl(repoUrl);
  if (!ref) {
    return {
      fields: { license: null, language: null, topics: [], homepage: null },
      error: 'invalid_repo_url',
    };
  }
  const res = await fetchHtml(ref.owner, ref.repo);
  if ('notFound' in res) {
    return {
      fields: { license: null, language: null, topics: [], homepage: null },
      notFound: true,
    };
  }
  if ('rateLimited' in res) {
    return {
      fields: { license: null, language: null, topics: [], homepage: null },
      rateLimited: true,
    };
  }
  if ('error' in res) {
    return {
      fields: { license: null, language: null, topics: [], homepage: null },
      error: res.error,
    };
  }
  const htmlLicense = extractLicense(res.html);
  const license = htmlLicense ?? (await fetchLicenseViaShields(ref.owner, ref.repo));
  return {
    fields: {
      license,
      language: extractLanguage(res.html),
      topics: extractTopics(res.html),
      homepage: extractHomepage(res.html),
    },
  };
}
