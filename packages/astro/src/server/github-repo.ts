/**
 * Server-side helper for fetching GitHub repository metadata.
 *
 * This exists so consumer pages can wire a thin `/api/github-repo`
 * endpoint that proxies `api.github.com` requests through their own
 * server (rather than from the visitor's browser). The visitor's
 * browser hitting `api.github.com` directly leaks their IP and burns
 * the per-IP unauthenticated rate limit (60/hour).
 *
 * Token handling:
 *   - If `token` is provided, it's sent as `Authorization: Bearer <token>`.
 *   - If not, the request goes unauthenticated (5000/hour if the server
 *     has a shared egress IP, 60/hour per-IP otherwise — much better
 *     than the per-visitor case).
 *   - Consumers are expected to source the token from a server-only
 *     env var (e.g. `process.env.GITHUB_TOKEN`) and never expose it.
 */

export interface FetchRepoMetadataInput {
  owner: string;
  repo: string;
  token?: string;
}

export interface FetchRepoMetadataResult {
  ok: true;
  data: GitHubRepoMetadata;
}

export interface FetchRepoMetadataError {
  ok: false;
  status: number;
  message: string;
}

export interface GitHubRepoMetadata {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  private: boolean;
  topics: string[];
}

const GITHUB_API = 'https://api.github.com';

export async function fetchRepoMetadata(
  input: FetchRepoMetadataInput,
): Promise<FetchRepoMetadataResult | FetchRepoMetadataError> {
  const { owner, repo, token } = input;
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    return { ok: false, status: 400, message: 'Invalid owner or repo name.' };
  }
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'grove-submission-proxy',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { ok: false, status: 502, message };
  }
  if (response.status === 404) {
    return { ok: false, status: 404, message: 'Repository not found or not public.' };
  }
  if (response.status === 403) {
    return { ok: false, status: 403, message: 'GitHub rate limit reached. Try again shortly.' };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: `GitHub returned ${response.status}.`,
    };
  }
  const json = (await response.json()) as {
    name: string;
    description: string | null;
    html_url: string;
    homepage: string | null;
    language: string | null;
    private: boolean;
    topics?: string[];
  };
  return {
    ok: true,
    data: {
      name: json.name,
      full_name: `${owner}/${repo}`,
      description: json.description,
      html_url: json.html_url,
      homepage: json.homepage,
      language: json.language,
      private: json.private,
      topics: json.topics ?? [],
    },
  };
}
