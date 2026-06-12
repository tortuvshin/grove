#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * enrich-github-metadata.mjs — HTML fallback for records that
 * haven't been touched by the API sync. Walks the public GitHub
 * HTML page for each repo and pulls topics, language, license,
 * homepage into the yml file.
 *
 * Lightweight (no auth required), but slower and less reliable
 * than `sync-github-metadata.mjs` (the API version). Use this as
 * a fallback when the API rate-limit is exhausted.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECORDS_DIR = join(ROOT, "data", "records");
const DRY_RUN = process.env.DRY_RUN === "1";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "grove-enricher",
};

function ownerRepo(repoUrl) {
  if (!repoUrl) return null;
  const m = String(repoUrl).match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

async function fetchHtml(owner, repo) {
  try {
    const res = await fetch(`https://github.com/${owner}/${repo}`, { headers: HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractMeta(html) {
  if (!html) return {};
  const out = {};
  const topicMatches = html.matchAll(/data-octo-click="topic_click"[^>]*>([^<]+)</g);
  if (topicMatches) {
    const topics = [...topicMatches].map((m) => m[1].trim()).filter(Boolean);
    if (topics.length) out.topics = topics;
  }
  const lang = html.match(/<span class="color-fg-default text-bold mr-1"[^>]*>([^<]+)</);
  if (lang) out.language = lang[1].trim();
  const license = html.match(/This repository is under the ([^<.]+) License/i);
  if (license) out.license = license[1].trim();
  return out;
}

async function main() {
  let files = [];
  try {
    files = (await readdir(RECORDS_DIR)).filter((f) => f.endsWith(".yml")).sort();
  } catch (err) {
    console.error("No data/records directory. Run `grove init` first.");
    process.exit(1);
  }

  let enriched = 0;
  for (const file of files) {
    const path = join(RECORDS_DIR, file);
    const text = await readFile(path, "utf8");
    const rec = parse(text) ?? {};
    const { owner, repo } = ownerRepo(rec.repoUrl ?? rec.links?.github) ?? {};
    if (!owner) continue;
    const html = await fetchHtml(owner, repo);
    const meta = extractMeta(html);
    const before = JSON.stringify(rec);
    if (meta.topics && !rec.topics) rec.topics = meta.topics;
    if (meta.language && !rec.language) rec.language = meta.language;
    if (meta.license && !rec.license) rec.license = meta.license;
    const after = JSON.stringify(rec);
    if (before === after) continue;
    if (DRY_RUN) {
      console.log(`  ~ ${file} (dry-run)`);
    } else {
      await writeFile(path, stringify(rec), "utf8");
      console.log(`  ✓ ${file}`);
    }
    enriched++;
  }
  console.log(`Enriched ${enriched} record${enriched === 1 ? "" : "s"}.`);
}

main().catch((err) => {
  console.error("enrich-github-metadata failed:", err);
  process.exit(1);
});
