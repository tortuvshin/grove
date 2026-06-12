#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * build-sitemap.mjs — emit public/sitemap.xml from the generated
 * index JSON. Thin wrapper around `@grove-dev/cli sitemap`.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["sitemap"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove sitemap`:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
