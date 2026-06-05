/** GitHub repo URL parsing helpers. */
export function getOwnerAndRepoFromRepoUrl(repoUrl: string): { owner: string | null; repo: string | null } {
  if (!repoUrl || !repoUrl.includes("github.com/")) return { owner: null, repo: null };
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return { owner: null, repo: null };
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export function getOwnerAvatarUrl(owner: string | null, size: number = 80): string | null {
  if (!owner) return null;
  return `https://avatars.githubusercontent.com/${owner}?v=4&s=${size}`;
}
