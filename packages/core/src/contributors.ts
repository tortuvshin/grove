import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface Contributor {
  username: string;
  avatarUrl?: string;
  profileUrl?: string;
  contributions: number;
}

export interface SyncContributorsOptions {
  cwd?: string;
  generatedDir?: string;
  /** Site repository URL. Falls back to generated site-config.json. */
  repoUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  generatedAt?: string;
}

export interface ContributorSyncResult {
  outputPath: string;
  repoStatsPath: string;
  repositories: number;
  contributors: number;
  failed: number;
}

function ownerRepo(record: Record<string, unknown>): { owner: string; repo: string } | null {
  const github = record.github as { fullName?: string } | undefined;
  const fullName = github?.fullName;
  if (fullName?.includes("/")) {
    const [owner, repo] = fullName.split("/", 2);
    if (owner && repo) return { owner, repo };
  }
  const links = record.links as { github?: string } | undefined;
  const repoUrl = String(record.repoUrl ?? links?.github ?? "");
  const match = /github\.com\/([^/]+)\/([^/?#]+)/i.exec(repoUrl);
  const owner = match?.[1];
  const repo = match?.[2];
  return owner && repo ? { owner, repo: repo.replace(/\.git$/, "") } : null;
}

export async function syncContributors(
  options: SyncContributorsOptions = {},
): Promise<ContributorSyncResult> {
  const cwd = options.cwd ?? process.cwd();
  const generatedDir = options.generatedDir ?? "data/generated";
  const indexPath = resolve(cwd, generatedDir, "records.index.json");
  const outputPath = resolve(cwd, generatedDir, "contributors.json");
  const repoStatsPath = resolve(cwd, generatedDir, "repo-stats.json");
  const siteConfigPath = resolve(cwd, generatedDir, "site-config.json");
  const siteConfig = JSON.parse(await readFile(siteConfigPath, "utf8")) as {
    repoUrl?: string;
  };
  const repoUrl = options.repoUrl ?? siteConfig.repoUrl ?? "";
  const ref = ownerRepo({ repoUrl });
  if (!ref) {
    throw new Error(
      `Cannot sync community metadata: ${indexPath} has no valid site repository URL.`,
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const token =
    options.token ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grove-sync-contributors",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const byUsername = new Map<string, Contributor>();
  let failed = 0;
  type GitHubContributor = {
        login?: string;
        avatar_url?: string;
        html_url?: string;
        contributions?: number;
  };
  const perPage = 100;
  for (let page = 1; ; page += 1) {
    const contributorsResponse = await fetchImpl(
      `https://api.github.com/repos/${ref.owner}/${ref.repo}/contributors?per_page=${perPage}&anon=false&page=${page}`,
      { headers },
    );
    if (!contributorsResponse.ok && contributorsResponse.status !== 204) {
      throw new Error(
        `GitHub contributors request failed for ${ref.owner}/${ref.repo} (page ${page}): ${contributorsResponse.status}`,
      );
    }
    const data = contributorsResponse.status === 204
      ? []
      : (await contributorsResponse.json()) as GitHubContributor[];
    for (const entry of data) {
      if (!entry.login) continue;
      byUsername.set(entry.login, {
        username: entry.login,
        ...(entry.avatar_url ? { avatarUrl: entry.avatar_url } : {}),
        ...(entry.html_url ? { profileUrl: entry.html_url } : {}),
        contributions: entry.contributions ?? 0,
      });
    }
    if (data.length < perPage) break;
  }

  const repositoryResponse = await fetchImpl(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}`,
    { headers },
  );
  if (!repositoryResponse.ok) {
    failed += 1;
  }
  const repository = repositoryResponse.ok
    ? await repositoryResponse.json() as {
        stargazers_count?: number;
        forks_count?: number;
        subscribers_count?: number;
        open_issues_count?: number;
        default_branch?: string;
        pushed_at?: string;
      }
    : {};

  const contributors = [...byUsername.values()].sort(
    (a, b) =>
      b.contributions - a.contributions ||
      a.username.localeCompare(b.username),
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        contributors,
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    repoStatsPath,
    JSON.stringify(
      {
        repoUrl: `https://github.com/${ref.owner}/${ref.repo}`,
        stars: repository.stargazers_count ?? 0,
        forks: repository.forks_count ?? 0,
        watchers: repository.subscribers_count ?? 0,
        openIssues: repository.open_issues_count ?? 0,
        contributors: contributors.length,
        defaultBranch: repository.default_branch,
        pushedAt: repository.pushed_at,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    outputPath,
    repoStatsPath,
    repositories: 1,
    contributors: contributors.length,
    failed,
  };
}
