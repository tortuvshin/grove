import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { syncContributors } from './contributors.js';

describe('syncContributors', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-contributors-'));
    await mkdir(join(cwd, 'data', 'generated'), { recursive: true });
    await writeFile(
      join(cwd, 'data', 'generated', 'site-config.json'),
      JSON.stringify({ repoUrl: 'https://github.com/acme/community' }),
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('syncs the site repository community and repository stats', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/repos/acme/community')) {
        return new Response(
          JSON.stringify({
            stargazers_count: 42,
            forks_count: 7,
            subscribers_count: 3,
            open_issues_count: 2,
            default_branch: 'main',
            pushed_at: '2026-07-01T00:00:00Z',
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          {
            login: 'alice',
            avatar_url: 'https://avatars.example/alice',
            html_url: 'https://github.com/alice',
            contributions: 7,
          },
          {
            login: 'bob',
            avatar_url: 'https://avatars.example/bob',
            html_url: 'https://github.com/bob',
            contributions: 2,
          },
        ]),
        { status: 200 },
      );
    };

    const result = await syncContributors({
      cwd,
      fetchImpl,
      generatedAt: '2026-06-25T00:00:00.000Z',
    });
    const output = JSON.parse(await readFile(result.outputPath, 'utf8')) as {
      generatedAt: string;
      contributors: Array<{ username: string; contributions: number }>;
    };
    const repoStats = JSON.parse(await readFile(result.repoStatsPath, 'utf8'));

    expect(output).toEqual({
      generatedAt: '2026-06-25T00:00:00.000Z',
      contributors: [
        {
          username: 'alice',
          avatarUrl: 'https://avatars.example/alice',
          profileUrl: 'https://github.com/alice',
          contributions: 7,
        },
        {
          username: 'bob',
          avatarUrl: 'https://avatars.example/bob',
          profileUrl: 'https://github.com/bob',
          contributions: 2,
        },
      ],
    });
    expect(result.repositories).toBe(1);
    expect(repoStats).toEqual({
      repoUrl: 'https://github.com/acme/community',
      stars: 42,
      forks: 7,
      watchers: 3,
      openIssues: 2,
      contributors: 2,
      defaultBranch: 'main',
      pushedAt: '2026-07-01T00:00:00Z',
    });
  });

  it('fetches every contributor page', async () => {
    const requested: string[] = [];
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      login: `user-${index}`,
      contributions: 1,
    }));
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requested.push(url);
      if (url.endsWith('/repos/acme/community')) {
        return new Response('{}', { status: 200 });
      }
      if (new URL(url).searchParams.get('page') === '1') {
        return new Response(JSON.stringify(firstPage), { status: 200 });
      }
      return new Response(JSON.stringify([{ login: 'page-two', contributions: 5 }]), {
        status: 200,
      });
    };

    const result = await syncContributors({ cwd, fetchImpl });

    expect(result.contributors).toBe(101);
    expect(requested.filter((url) => url.includes('/contributors?'))).toEqual([
      'https://api.github.com/repos/acme/community/contributors?per_page=100&anon=false&page=1',
      'https://api.github.com/repos/acme/community/contributors?per_page=100&anon=false&page=2',
    ]);
  });
});
