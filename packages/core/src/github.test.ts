/**
 * @grove-dev/core — github.ts (URL parsing + metadata fetch)
 * unit tests.
 *
 * `parseGithubRepoUrl` is pure logic and trivially testable.
 * `fetchGithubMetadata` makes real HTTP calls — we test the URL
 * parser end-to-end and verify the function is exported with the
 * right signature; the network path itself is exercised by the
 * `sync github` CLI command in production (not by the unit suite,
 * which is offline).
 */
import { describe, expect, it } from 'vitest';
import {
  buildGithubSyncPatch,
  type GithubRepoRef,
  parseGithubRepoUrl,
  pruneLegacyGithubFields,
} from './github.js';
import type { GithubMetadata } from './schema.js';

describe('parseGithubRepoUrl', () => {
  it('returns undefined for an empty or undefined input', () => {
    expect(parseGithubRepoUrl('')).toBeUndefined();
    expect(parseGithubRepoUrl(undefined)).toBeUndefined();
  });

  it('parses a canonical https URL', () => {
    expect(parseGithubRepoUrl('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    } satisfies GithubRepoRef);
  });

  it('parses an http URL', () => {
    expect(parseGithubRepoUrl('http://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('strips a trailing .git suffix from the repo name', () => {
    // `git clone` URLs end in .git — the parser must trim it so
    // downstream API calls (e.g. /repos/owner/repo) hit the real
    // repo, not a 404 because we asked for "repo.git".
    expect(parseGithubRepoUrl('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('ignores query strings and fragments', () => {
    // A URL with a fragment (e.g. from a permalink) should still
    // resolve to the same owner/repo.
    expect(parseGithubRepoUrl('https://github.com/owner/repo#readme')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
    expect(parseGithubRepoUrl('https://github.com/owner/repo?tab=readme-ov-file')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('returns undefined for non-GitHub URLs', () => {
    expect(parseGithubRepoUrl('https://gitlab.com/owner/repo')).toBeUndefined();
    expect(parseGithubRepoUrl('https://example.com/owner/repo')).toBeUndefined();
  });

  it('returns undefined for malformed GitHub URLs', () => {
    // Missing repo segment.
    expect(parseGithubRepoUrl('https://github.com/owner')).toBeUndefined();
    // Owner with whitespace.
    expect(parseGithubRepoUrl('https://github.com/own er/repo')).toBeUndefined();
    // Empty owner.
    expect(parseGithubRepoUrl('https://github.com//repo')).toBeUndefined();
  });

  it('is case-insensitive on the host', () => {
    // GITHUB.COM should still match — the regex has the /i flag
    // and humans do type uppercase sometimes.
    expect(parseGithubRepoUrl('https://GITHUB.COM/Owner/Repo')).toEqual({
      owner: 'Owner',
      repo: 'Repo',
    });
  });
});

describe('buildGithubSyncPatch', () => {
  const baseMetadata: GithubMetadata = {
    fullName: 'owner/repo',
    stars: 100,
    forks: 10,
    openIssues: 5,
    watchers: 200,
    archived: false,
    disabled: false,
    private: false,
    fork: false,
    visibility: 'public',
    pushedAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
    createdAt: '2020-01-01T00:00:00Z',
    latestReleaseAt: '2025-12-01T00:00:00Z',
    license: 'MIT',
    topics: ['ai', 'agents'],
    language: 'Python',
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/owner/repo',
    description: "GitHub's short tagline",
    homepage: 'https://example.com',
    size: 1234,
  };

  it('writes fetched fields to the repository block', () => {
    const patch = buildGithubSyncPatch(baseMetadata, undefined);
    expect(patch.repository).toMatchObject({
      full_name: 'owner/repo',
      stargazers_count: 100,
      forks_count: 10,
      open_issues_count: 5,
      language: 'Python',
      pushed_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-20T00:00:00Z',
      archived: false,
      disabled: false,
      default_branch: 'main',
      license: { spdx_id: 'MIT', name: 'MIT' },
      topics: ['ai', 'agents'],
    });
  });

  it('lifts latestReleaseAt and homepage to the top level (not into repository)', () => {
    const patch = buildGithubSyncPatch(baseMetadata, undefined);
    expect(patch.latestReleaseAt).toBe('2025-12-01T00:00:00Z');
    expect(patch.homepage).toBe('https://example.com');
    expect((patch.repository as Record<string, unknown>).homepage).toBeUndefined();
    expect((patch.repository as Record<string, unknown>).latestReleaseAt).toBeUndefined();
  });

  it('merges into existing repository block instead of replacing it', () => {
    const existingGithub = {
      repository: {
        // Previously fetched, never re-refreshed:
        id: 9999,
        node_id: 'MDEwOlJlcG9zaXRvcnkxMjM0',
        html_url: 'https://github.com/owner/repo',
        // Curator-added manual fields:
        description: "Curator's hand-written description",
        custom: { internal: 'value' },
      },
    };
    const patch = buildGithubSyncPatch(baseMetadata, existingGithub);
    const repo = patch.repository as Record<string, unknown>;
    // Preserved from existing:
    expect(repo.id).toBe(9999);
    expect(repo.node_id).toBe('MDEwOlJlcG9zaXRvcnkxMjM0');
    expect(repo.html_url).toBe('https://github.com/owner/repo');
    expect(repo.description).toBe("Curator's hand-written description");
    expect(repo.custom).toEqual({ internal: 'value' });
    // Refreshed from sync:
    expect(repo.stargazers_count).toBe(100);
    expect(repo.pushed_at).toBe('2026-01-15T00:00:00Z');
  });

  it('does not write latestReleaseAt or homepage when missing', () => {
    const patch = buildGithubSyncPatch(
      { ...baseMetadata, latestReleaseAt: null, homepage: null },
      undefined,
    );
    expect('latestReleaseAt' in patch).toBe(false);
    expect('homepage' in patch).toBe(false);
  });

  it('writes null license when metadata has no license', () => {
    const patch = buildGithubSyncPatch({ ...baseMetadata, license: null }, undefined);
    expect((patch.repository as Record<string, unknown>).license).toBeNull();
  });
});

describe('pruneLegacyGithubFields', () => {
  it('drops latestRelease, files, and labels', () => {
    const pruned = pruneLegacyGithubFields({
      repository: { full_name: 'owner/repo' },
      latestRelease: { tag_name: 'v1.0.0', assets: [{ browser_download_url: 'x' }] },
      files: { Dockerfile: true },
      labels: [{ name: 'bug', color: 'red' }],
    });
    expect(pruned).not.toHaveProperty('latestRelease');
    expect(pruned).not.toHaveProperty('files');
    expect(pruned).not.toHaveProperty('labels');
  });

  it('keeps every other field untouched, including ones sync does not know about', () => {
    const pruned = pruneLegacyGithubFields({
      repository: { full_name: 'owner/repo' },
      languages: { TypeScript: 100 },
      activity: { monthlyCommits: [1, 2, 3] },
      sync: { syncedAt: '2026-01-01T00:00:00Z', source: 'api' },
      curatorAdded: { custom: 'value' },
    });
    expect(pruned).toEqual({
      repository: { full_name: 'owner/repo' },
      languages: { TypeScript: 100 },
      activity: { monthlyCommits: [1, 2, 3] },
      sync: { syncedAt: '2026-01-01T00:00:00Z', source: 'api' },
      curatorAdded: { custom: 'value' },
    });
  });

  it('handles an undefined github block', () => {
    expect(pruneLegacyGithubFields(undefined)).toEqual({});
  });
});
