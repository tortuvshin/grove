#!/usr/bin/env node
// SPDX-License-Identifier: MIT

/**
 * validate-records.mjs — Zod-schema validation for every record yml.
 *
 * Thin wrapper around `@grove-dev/cli`'s `validate` command so the
 * `pnpm run validate:data` script works without V0 command names.
 *
 * For schema authoring see `packages/core/src/schema.ts`. The CLI
 * handles every blueprint (project-directory, resource-hub,
 * ecosystem-map) and every record kind (project, resource, entity).
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("grove", ["validate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("Failed to spawn `grove validate`:", result.error.message);
  console.error("Make sure `@grove-dev/cli` is installed and on PATH.");
  process.exit(1);
}

process.exit(result.status ?? 0);
