// Last-commit dates for docs content files, used by @astrojs/sitemap's
// `serialize` hook to emit <lastmod>. One `git log` pass over the content
// directory builds a map from content-relative path (e.g.
// "automation/audit.md") to ISO date; commits are emitted newest-first, so
// the first date seen per file wins. Returns an empty map on any failure
// (no git binary, shallow clone on the deploy image) — the sitemap then
// simply omits lastmod rather than breaking the build or lying with a
// uniform build date.
import { execFileSync } from 'node:child_process';

const CONTENT_MARKER = 'src/content/docs/';

export function buildLastmodMap(contentDir = CONTENT_MARKER, cwd = process.cwd()) {
  const map = new Map();
  try {
    // A shallow clone (Cloudflare's build image fetches depth 1) reports
    // the single fetched commit's date for every file — a uniform, false
    // lastmod is worse than none, so bail out entirely.
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    if (shallow === 'true') return map;
    const out = execFileSync('git', ['log', '--format=%x00%cI', '--name-only', '--', contentDir], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    let current;
    for (const rawLine of out.split('\n')) {
      if (rawLine.startsWith('\0')) {
        current = rawLine.slice(1).trim();
        continue;
      }
      // git prints paths relative to the repo root regardless of cwd;
      // key on the part after src/content/docs/ so lookups don't care
      // where the build ran from.
      const marker = rawLine.indexOf(CONTENT_MARKER);
      if (marker === -1 || !current) continue;
      const key = rawLine.slice(marker + CONTENT_MARKER.length).trim();
      if (key && !map.has(key)) map.set(key, current);
    }
  } catch {
    // Git unavailable — leave the map empty.
    return map;
  }
  // Belt and braces: if every file carries the same date the history is
  // not per-file (e.g. a grafted clone) — drop it rather than lie.
  if (map.size > 1 && new Set(map.values()).size === 1) map.clear();
  return map;
}
