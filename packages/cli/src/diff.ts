// SPDX-License-Identifier: MIT
/**
 * Three-way file classifier for `grove update`.
 *
 * Given (installed, lock, registry) hashes per file, classify the
 * file into one of the buckets documented in
 * `apps/docs/concepts/registry.md`:
 *
 *   unchanged       — installed == lock == registry
 *   upstream_changed — lock == registry, installed == lock
 *   new             — absent in installed + lock, present in registry
 *   locally_modified — installed ≠ lock, registry == lock
 *   conflict        — installed ≠ lock, registry ≠ lock
 *   removed         — present in installed + lock, absent in registry
 *
 * The locally_modified rule is load-bearing — see §5 of
 * apps/docs/v1-architecture.md. `grove update` never overwrites a
 * locally-modified file even with `--force`. The function encodes
 * this rule by returning `locally_modified` whenever installed
 * differs from lock and the registry state matches lock; callers
 * that want to override anyway must do so explicitly.
 */
import type { Sha256Hash } from './hash.js';

export type UpdateClassification =
  | 'unchanged'
  | 'upstream_changed'
  | 'new'
  | 'locally_modified'
  | 'conflict'
  | 'removed';

export interface FileState {
  installed: Sha256Hash | null;
  lock: Sha256Hash | null;
  registry: Sha256Hash | null;
}

export function classify(state: FileState): UpdateClassification {
  const { installed, lock, registry } = state;
  if (installed === null && lock === null && registry !== null) return 'new';
  if (installed !== null && lock !== null && registry === null) return 'removed';
  if (installed === null && lock === null && registry === null) return 'unchanged';
  if (installed !== null && lock === null && registry !== null) return 'new';
  if (
    installed !== null &&
    lock !== null &&
    registry !== null &&
    installed === lock &&
    lock === registry
  ) {
    return 'unchanged';
  }
  if (
    installed !== null &&
    lock !== null &&
    registry !== null &&
    installed === lock &&
    lock !== registry
  ) {
    return 'upstream_changed';
  }
  if (
    installed !== null &&
    lock !== null &&
    registry !== null &&
    installed !== lock &&
    registry === lock
  ) {
    return 'locally_modified';
  }
  if (
    installed !== null &&
    lock !== null &&
    registry !== null &&
    installed !== lock &&
    registry !== lock
  ) {
    return 'conflict';
  }
  // Fallback for states we haven't enumerated (e.g. installed === null
  // with lock !== null + registry === null): conservatively mark as
  // removed so the user sees something actionable.
  return 'removed';
}

export interface UpdatePlan {
  unchanged: string[];
  upstream_changed: string[];
  new: string[];
  locally_modified: string[];
  conflict: string[];
  removed: string[];
}

/**
 * Build the full update plan for a scaffold by walking the union of
 * installed, lock, and registry files.
 */
export function planUpdate(
  installed: Map<string, Sha256Hash | null>,
  lock: Map<string, Sha256Hash | null>,
  registry: Map<string, Sha256Hash | null>,
): UpdatePlan {
  const keys = new Set<string>([...installed.keys(), ...lock.keys(), ...registry.keys()]);
  const plan: UpdatePlan = {
    unchanged: [],
    upstream_changed: [],
    new: [],
    locally_modified: [],
    conflict: [],
    removed: [],
  };
  for (const key of keys) {
    const state: FileState = {
      installed: installed.get(key) ?? null,
      lock: lock.get(key) ?? null,
      registry: registry.get(key) ?? null,
    };
    plan[classify(state)].push(key);
  }
  for (const arr of Object.values(plan)) arr.sort();
  return plan;
}
