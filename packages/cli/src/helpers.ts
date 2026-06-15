/**
 * Shared CLI helpers — pure functions, side-effect-free.
 *
 * Extracted from `index.ts` so they can be unit-tested without
 * pulling in the whole commander program (whose
 * `program.parseAsync()` at module-load time calls `process.exit(1)`
 * when no args are present — a test-hostile side effect).
 */

export const DEPLOY_PROVIDERS = [
  "vercel",
  "netlify",
  "cloudflare",
  "github-pages",
  "none",
] as const;

export type DeployProvider = (typeof DEPLOY_PROVIDERS)[number];

/**
 * Parse a `--deploy` flag value into a typed `DeployProvider`.
 *
 * - `undefined` (flag not passed) → "github-pages" (the historical
 *   default; matches commander.js's default-arg behaviour).
 * - A valid provider name → returned unchanged.
 * - Anything else → process exits 1 with the list of valid providers.
 *
 * The previous implementation silently coerced invalid values to
 * "github-pages", which masked typos in CI scripts (audit finding).
 *
 * Exported from `index.ts` via re-export — keeping the source of
 * truth in this helper module means a test can import
 * `parseDeployProvider` without booting the whole CLI program.
 */
export function parseDeployProvider(value: string | undefined): DeployProvider {
  if (value === undefined) return "github-pages";
  if ((DEPLOY_PROVIDERS as readonly string[]).includes(value)) {
    return value as DeployProvider;
  }
  console.error(`Unknown deploy provider: ${value}.`);
  console.error(`Try one of: ${DEPLOY_PROVIDERS.join(", ")}`);
  process.exit(1);
}
