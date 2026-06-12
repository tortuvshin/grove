#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * sync-github-metadata.mjs — full metadata sync from GitHub's
 * REST API. Wrapper around `@grove-dev/cli sync github`.
 *
 * Refreshes stargazers_count, forks_count, license, default branch,
 * pushed_at, language, topics, and the contributor list for every
 * record whose `repoUrl` is a GitHub repository.
 *
 * Writes back into the corresponding `data/records/<slug>.yml` (the
 * CLI is conservative — only fills in fields that are currently
 * empty).
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["sync", "github"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove sync github`:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
