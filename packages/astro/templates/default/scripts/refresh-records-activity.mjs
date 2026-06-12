#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * refresh-records-activity.mjs — daily activity refresh.
 *
 * Wrapper around `grove sync github` (the same command used by
 * the weekly metadata sync, but the action wires it to a daily
 * cron so the directory stays current with each app's recent
 * commit history and GitHub stars).
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
