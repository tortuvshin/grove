#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * build-llms.mjs — generate public/llms.txt + public/llms-full.txt.
 *
 * LLM-friendly mirror of the directory: short version in
 * `llms.txt`, full per-record version in `llms-full.txt`. The CLI's
 * `llms` command handles both files using `data/generated/records.*.json`
 * plus `data/generated/site-config.json`.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["llms"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove llms`:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
