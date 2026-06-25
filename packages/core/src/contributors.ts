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
  token?: string;
  fetchImpl?: typeof fetch;
  generatedAt?: string;
}

export interface ContributorSyncResult {
  outputPath: string;
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
  const payload = JSON.parse(await readFile(indexPath, "utf8")) as {
    records?: Array<Record<string, unknown>>;
  };
  const fetchImpl = options.fetchImpl ?? fetch;
  const token =
    options.token ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grove-sync-contributors",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const repositories = new Map<string, { owner: string; repo: string }>();
  for (const record of payload.records ?? []) {
    const ref = ownerRepo(record);
    if (ref) repositories.set(`${ref.owner}/${ref.repo}`.toLowerCase(), ref);
  }

  const byUsername = new Map<string, Contributor>();
  let failed = 0;
  for (const ref of repositories.values()) {
    try {
      const response = await fetchImpl(
        `https://api.github.com/repos/${ref.owner}/${ref.repo}/contributors?per_page=100&anon=false`,
        { headers },
      );
      if (response.status === 404 || response.status === 204) continue;
      if (!response.ok) {
        failed += 1;
        continue;
      }
      const data = (await response.json()) as Array<{
        login?: string;
        avatar_url?: string;
        html_url?: string;
        contributions?: number;
      }>;
      for (const entry of data) {
        if (!entry.login) continue;
        const current = byUsername.get(entry.login);
        if (current) {
          current.contributions += entry.contributions ?? 0;
        } else {
          byUsername.set(entry.login, {
            username: entry.login,
            ...(entry.avatar_url ? { avatarUrl: entry.avatar_url } : {}),
            ...(entry.html_url ? { profileUrl: entry.html_url } : {}),
            contributions: entry.contributions ?? 0,
          });
        }
      }
    } catch {
      failed += 1;
    }
  }

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

  return {
    outputPath,
    repositories: repositories.size,
    contributors: contributors.length,
    failed,
  };
}
