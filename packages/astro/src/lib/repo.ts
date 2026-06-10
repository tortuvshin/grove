/**
 * Parse a GitHub repo URL into its owner and repo components.
 *
 * Returns `null` (not `{ owner: null, repo: null }`) if the URL
 * doesn't match the github.com path shape — this lets callers
 * distinguish "no URL" from "URL without owner" with a single
 * null check.
 *
 * Used in:
 *  - ItemCard / AppCard avatar fallback (owner avatar via GitHub
 *    avatars API).
 *  - Detail page (showing owner + repo name in breadcrumb / header).
 *  - Anywhere we need to display "@owner / repo" or link to the owner.
 */
export function getOwnerAndRepoFromRepoUrl(
  repoUrl: string | null | undefined,
): { owner: string; repo: string } | null {
  if (!repoUrl || !repoUrl.includes("github.com/")) return null;
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2].replace(/\.git$/, ""),
  };
}

/**
 * Build a GitHub avatar URL for a given owner. Defaults to size 80
 * which is the smallest "high quality" size in GitHub's avatar CDN.
 *
 * Returns a string (not nullable) so callers can plug the result
 * straight into an `src` attribute. The avatar endpoint always
 * returns a placeholder image for unknown owners, so the only
 * reason to check `null` upstream is when you specifically want
 * to render a different fallback (e.g. initials).
 */
export function getOwnerAvatarUrl(owner: string, size = 80): string {
  if (!owner) {
    // Defensive: callers may pass a possibly-empty string. Return the
    // generic GitHub identicon so an `<img>` doesn't 404.
    return `https://avatars.githubusercontent.com/identicon?v=4&s=${size}`;
  }
  return `https://avatars.githubusercontent.com/${owner}?v=4&s=${size}`;
}
