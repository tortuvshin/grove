#!/usr/bin/env node
/**
 * sync-contributors — fetch contributors for every record's repoUrl
 * and write `data/generated/contributors.json` (consumed by the home
 * page and the /contributors page).
 *
 * Generic: walks every record in data/generated/records.index.json,
 * looks at record.github.fullName or links.github, and calls the
 * GitHub /repos/{owner}/{repo}/contributors endpoint. Aggregates by
 * owner (across all of an owner's projects in the directory).
 *
 * Anonymous contributors are excluded — the home grid renders <a>
 * avatars, and a name-less contributor is more confusing than
 * missing.
 *
 * Usage:  node scripts/sync-contributors.mjs
 * Env:    GH_TOKEN  — required for >60 req/h. Falls back to unauth.
 *
 * V1 intentionally small: no retries, no rate-limit backoff beyond
 * the basic 403-detection. The weekly schedule in
 * .github/workflows/sync-contributors.yml is loose enough that
 * re-running the workflow is a fine recovery path.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = resolve(HERE, "..");
const GENERATED = resolve(ROOT, "data", "generated");
const INDEX_PATH = resolve(GENERATED, "records.index.json");
const OUT_PATH = resolve(GENERATED, "contributors.json");

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "grove-sync-contributors",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
};

function ownerRepoFromFullName(fullName) {
  if (!fullName || !fullName.includes("/")) return null;
  const [owner, repo] = fullName.split("/", 2);
  return { owner, repo };
}

async function ghJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 204) return null;
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new Error(`rate-limited (403) on ${url}`);
    }
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function fetchContributorsForRepo(owner, repo) {
  // GitHub caps /contributors at 500; for our purposes (fanning into
  // a home grid) we only need the first page. Anonymous entries
  // (no `login`) are dropped at parse time.
  const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100&anon=false`;
  const data = await ghJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((c) => c && c.login)
    .map((c) => ({
      username: c.login,
      avatarUrl: c.avatar_url,
      profileUrl: c.html_url,
      contributions: c.contributions ?? 0,
    }));
}

async function main() {
  let index;
  try {
    index = JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch (err) {
    console.error(`Could not read ${INDEX_PATH}: ${err.message}`);
    console.error("Run `pnpm run build:data` first.");
    process.exit(1);
  }

  const records = Array.isArray(index.records) ? index.records : [];
  // Group by owner — a single person with three projects in the
  // directory shows up once with the summed contribution count.
  const byOwner = new Map();
  const seenRepos = new Set();

  for (const r of records) {
    const gh = r.github || {};
    const ref = ownerRepoFromFullName(gh.fullName) || (() => {
      const url = r.repoUrl || (r.links && r.links.github) || "";
      const m = /github\.com\/([^/]+)\/([^/?#]+)/.exec(url);
      return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
    })();
    if (!ref) continue;
    if (seenRepos.has(`${ref.owner}/${ref.repo}`)) continue;
    seenRepos.add(`${ref.owner}/${ref.repo}`);

    try {
      const list = await fetchContributorsForRepo(ref.owner, ref.repo);
      for (const c of list) {
        const existing = byOwner.get(c.username);
        if (existing) {
          existing.contributions = (existing.contributions ?? 0) + c.contributions;
        } else {
          byOwner.set(c.username, c);
        }
      }
      console.log(`  ${ref.owner}/${ref.repo}: ${list.length} contributors`);
    } catch (err) {
      console.warn(`  ${ref.owner}/${ref.repo}: ${err.message}`);
    }
  }

  const contributors = [...byOwner.values()].sort(
    (a, b) => (b.contributions ?? 0) - (a.contributions ?? 0),
  );

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        contributors,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nWrote ${contributors.length} contributors → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
