// SPDX-License-Identifier: MIT
/**
 * Pure YAML string helpers used by the submit form (and any future
 * surface that emits record YAML for hand-curated directories).
 *
 * The pre-v1 implementation lived inline inside
 * `packages/astro/src/components/SubmissionClient.astro` (lines
 * 64–73, 92–124). That broke §11 of `apps/docs/v1-architecture.md`:
 * UI files must not contain serialization logic. This module is
 * the canonical home.
 *
 * The helpers are deliberately tiny and dependency-free so they
 * can run in both Node (during `grove submit` builds) and the
 * browser (the live form's preview).
 */

/**
 * Convert any input to a URL-safe, hyphen-separated slug.
 *
 * Returns the empty string for falsy input. Mirrors the inline
 * behavior that shipped in v0.7 so existing form submissions stay
 * byte-identical.
 */
export function recordSlugify(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse a GitHub repository URL into `{ owner, repo }`. Returns
 * null if the input is not a recognized GitHub URL. The `.git`
 * suffix is stripped so callers can compare against canonical
 * GitHub names without a normalization step.
 */
export interface ParsedRepo {
  owner: string;
  repo: string;
}

export function parseGithubRepo(value: unknown): ParsedRepo | null {
  const match = String(value ?? '').match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  const owner = match[1] ?? '';
  const repo = (match[2] ?? '').replace(/\.git$/, '');
  return { owner, repo };
}

/**
 * Quote a value for safe inclusion inside a YAML double-quoted
 * scalar. Escapes backslashes and double quotes; leaves the rest
 * alone. Matches the v0.7 inline behavior; if the value contains
 * a newline the YAML consumer must use folded/block style instead.
 */
export function yamlQuote(value: unknown): string {
  return `"${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;
}

/**
 * Render a YAML block sequence with a given indent. Produces
 * `- a\n- b\n…` for the given input array. Empty arrays produce
 * an empty string so the caller can choose to emit `[]` instead.
 */
export function yamlLines(values: readonly string[], indent = 2): string {
  return values.map((value) => `${' '.repeat(indent)}- ${value}`).join('\n');
}
