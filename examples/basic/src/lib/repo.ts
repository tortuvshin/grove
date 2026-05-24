/**
 * Parse a GitHub repo URL into its owner and repo components.
 * Returns nulls if the URL doesn't match github.com/{owner}/{repo}.
 *
 * Used in:
 *   - AppCard avatar fallback (owner avatar via GitHub avatars API)
 *   - App detail page (showing owner + repo name in breadcrumb / header)
 *   - Anywhere we need to display "@owner / repo" or link to the owner
 */
export function getOwnerAndRepoFromRepoUrl(repoUrl: string): {
  owner: string | null;
  repo: string | null;
} {
  if (!repoUrl || !repoUrl.includes("github.com/")) {
    return { owner: null, repo: null };
  }
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return { owner: null, repo: null };
  return {
    owner: m[1],
    repo: m[2].replace(/\.git$/, ""),
  };
}

/**
 * Build a GitHub avatar URL for a given owner.
 * Returns null if owner is null/empty.
 */
export function getOwnerAvatarUrl(owner: string | null, size: number = 80): string | null {
  if (!owner) return null;
  return `https://avatars.githubusercontent.com/${owner}?v=4&s=${size}`;
}
