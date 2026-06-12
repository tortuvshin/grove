#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * report-cleanup-candidates.mjs — flag records that look like
 * they should be archived. Wrapper around `grove cleanup stale`,
 * which writes a markdown report under `data/generated/`.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["cleanup", "stale"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove cleanup stale`:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
