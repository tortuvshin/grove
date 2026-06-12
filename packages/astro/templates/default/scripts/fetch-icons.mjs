#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * fetch-icons.mjs — download brand icons from the public
 * `xandemon/developer-icons` repository (CC0 licensed) and save them
 * to `public/icons/` so Astro can serve them as static assets.
 *
 * Run automatically before dev/build via the npm scripts.
 *
 * Icon map below mirrors the openapps catalogue. Add or remove
 * entries as the blueprint's taxonomy evolves.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_BASE = join(ROOT, "public", "icons");

const SOURCE = "https://raw.githubusercontent.com/xandemon/developer-icons/main/icons";

// Stack icons (xandemon/developer-icons naming).
const STACK_ICONS = [
  "android",
  "apple-dark",
  "apple-light",
  "capacitor",
  "dart",
  "firebase",
  "flutter",
  "graphql",
  "ionic",
  "java",
  "javascript",
  "kotlin",
  "mongodb",
  "nodejs",
  "python",
  "react",
  "react-native",
  "rust",
  "solidity",
  "swift",
  "tensorflow",
  "typescript",
];

// Platform icons (custom paths under /icons/platforms/).
const PLATFORM_ICONS = [
  "android",
  "apple-dark",
  "apple-light",
  "chrome",
  "chromeos",
  "desktop",
  "embedded",
  "ios",
  "linux",
  "macos",
  "ubuntu",
  "web",
  "windows",
];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function fetchAndSave(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function main() {
  // Stack icons
  const stackDir = join(OUT_BASE, "stacks");
  if (!(await exists(stackDir))) await mkdir(stackDir, { recursive: true });
  for (const name of STACK_ICONS) {
    const url = `${SOURCE}/${name}/${name}-original.svg`;
    const dest = join(stackDir, `${name}.svg`);
    try {
      await fetchAndSave(url, dest);
      console.log(`  ✓ stack/${name}`);
    } catch (err) {
      console.warn(`  ✗ stack/${name}: ${err.message}`);
    }
  }

  // Platform icons (apple-dark / apple-light already downloaded as
  // stack icons; we re-use them under platforms/).
  const platDir = join(OUT_BASE, "platforms");
  if (!(await exists(platDir))) await mkdir(platDir, { recursive: true });
  for (const name of PLATFORM_ICONS) {
    const src = join(stackDir, `${name}.svg`);
    const dest = join(platDir, `${name}.svg`);
    if (await exists(src)) {
      const buf = await (await import("node:fs/promises")).readFile(src);
      await writeFile(dest, buf);
      console.log(`  ✓ platform/${name} (from stack cache)`);
    } else {
      // Try a direct fetch as a fallback.
      const url = `${SOURCE}/${name}/${name}-original.svg`;
      try {
        await fetchAndSave(url, dest);
        console.log(`  ✓ platform/${name}`);
      } catch (err) {
        console.warn(`  ✗ platform/${name}: ${err.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("fetch-icons failed:", err);
  process.exit(1);
});
