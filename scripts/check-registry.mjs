// SPDX-License-Identifier: MIT
/**
 * Validate packages/registry/registry.json against its source tree
 * without building. Same rules the build enforces (scripts/lib/
 * registry.mjs); this is the fast CI gate and the local pre-commit
 * check.
 */
import { validateRegistry } from "./lib/registry.mjs";

const errors = validateRegistry();
if (errors.length > 0) {
  console.error(`Registry invariants violated (${errors.length}):\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log("Registry invariants OK.");
