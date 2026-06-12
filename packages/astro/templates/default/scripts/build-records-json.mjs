#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * build-records-json.mjs — yml → normalized JSON.
 *
 * Wraps `@grove-dev/cli generate`, which produces:
 *   - data/generated/records.full.json   (every record, all fields)
 *   - data/generated/records.index.json  (slim projection, visible only)
 *   - data/generated/records.json        (alias of records.full.json)
 *   - data/generated/site-config.json    (current blueprint + stats)
 *
 * Run by `pnpm run build:data` (also pre-build).
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["generate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove generate`:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
