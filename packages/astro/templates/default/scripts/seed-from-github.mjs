#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * seed-from-github.mjs — interactive seeder for the first
 * record. Given a GitHub URL, fetch the metadata and write a
 * starter yml to `data/records/<slug>.yml`. Useful for the
 * "add my repo" onboarding path.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECORDS_DIR = join(ROOT, "data", "records");

const url = process.argv[2];
if (!url) {
  console.error("Usage: node seed-from-github.mjs <github-url>");
  process.exit(1);
}

const match = String(url).match(/github\.com\/([^/]+)\/([^/?#]+)/);
if (!match) {
  console.error("Not a GitHub URL:", url);
  process.exit(1);
}
const owner = match[1];
const repo = match[2].replace(/\.git$/, "");

const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "grove-seeder" },
});
if (!res.ok) {
  console.error("GitHub returned", res.status);
  process.exit(1);
}
const r = await res.json();
const slug = repo.toLowerCase();
const rec = {
  kind: "project",
  slug,
  name: r.name,
  description: r.description ?? "",
  repoUrl: r.html_url,
  homepageUrl: r.homepage ?? "",
  category: "tools",
  stack: r.language ?? "",
  stacks: [],
  platforms: [],
  tags: r.topics ?? [],
  stars: r.stargazers_count,
  license: r.license?.spdx_id ?? "",
  status: r.archived ? "archived" : "active",
  curation: { reviewed: false, labels: [] },
};

await mkdir(RECORDS_DIR, { recursive: true });
await writeFile(join(RECORDS_DIR, `${slug}.yml`), stringify(rec), "utf8");
console.log(`Wrote ${slug}.yml`);
