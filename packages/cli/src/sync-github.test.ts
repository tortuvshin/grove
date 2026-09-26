import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type GithubMetadata, type GroveConfig } from '@grove-dev/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateGithubCache } from './migrate-cli.js';
import { runGithubSync } from './sync-github.js';

const config: GroveConfig = defineConfig({
  site: { name: 'test', tagline: 'test' },
  blueprint: 'project-directory',
  integrations: { github: { metadata: true, health: true } },
});

const RECORD = [
  '# curator comment',
  'kind: project',
  'slug: demo',
  'name: Demo',
  'repoUrl: https://github.com/owner/demo',
  'health:',
  '  status: stale',
  '  visibility: keep',
  'github:',
  '  repository:',
  '    stargazers_count: 1',
  '    custom_field: kept',
  '  sync:',
  '    syncedAt: 2026-09-01T00:00:00.000Z',
  '    source: api',
  '',
].join('\n');

const metadata: GithubMetadata = {
  fullName: 'owner/demo',
  stars: 50,
  forks: 2,
  archived: false,
  topics: ['cli'],
  pushedAt: new Date().toISOString(),
  latestReleaseAt: new Date().toISOString(),
  license: 'MIT',
  description: 'Upstream description',
};

describe('runGithubSync', () => {
  let cwd: string;
  let recordPath: string;
  const at = new Date('2026-09-26T00:00:00.000Z');

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-sync-github-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    recordPath = join(cwd, 'data', 'records', 'demo.yml');
    await writeFile(recordPath, RECORD);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  async function cached() {
    return JSON.parse(await readFile(join(cwd, 'data', 'cache', 'github', 'demo.json'), 'utf8'));
  }

  it('writes the cache and never touches the record', async () => {
    const run = await runGithubSync({
      cwd,
      config,
      fetchMetadata: async () => metadata,
      now: () => at,
      log: () => {},
    });
    expect(run.outcomes).toEqual([{ slug: 'demo', outcome: 'api' }]);
    expect(run.inlineRecords).toEqual(['demo']);
    expect(await readFile(recordPath, 'utf8')).toBe(RECORD);
    const entry = await cached();
    expect(entry.lastSuccessAt).toBe(at.toISOString());
    expect(entry.source).toBe('api');
    expect(entry.sourceDescription).toBe('Upstream description');
    expect(entry.health.status).toBe('active');
    // Seeded from the inline block: fields sync does not own survive.
    expect(entry.github.repository).toMatchObject({ stargazers_count: 50, custom_field: 'kept' });
    expect(entry.github.sync).toEqual({ syncedAt: at.toISOString(), source: 'api' });
  });

  it('keeps previous data and records failures when both fetch paths fail', async () => {
    await runGithubSync({
      cwd,
      config,
      fetchMetadata: async () => metadata,
      now: () => at,
      log: () => {},
    });
    const first = await cached();
    const later = new Date('2026-10-03T00:00:00.000Z');
    const run = await runGithubSync({
      cwd,
      config,
      fetchMetadata: async () => {
        throw new Error('GitHub API 502 Bad Gateway');
      },
      fetchHtml: async () => ({
        fields: { license: null, language: null, topics: [], homepage: null },
        rateLimited: true,
      }),
      now: () => later,
      log: () => {},
    });
    expect(run.outcomes).toEqual([
      {
        slug: 'demo',
        outcome: 'failed',
        reason: 'API: GitHub API 502 Bad Gateway; HTML: rate limited',
      },
    ]);
    const second = await cached();
    expect(second.github).toEqual(first.github);
    expect(second.health).toEqual(first.health);
    expect(second.lastSuccessAt).toBe(at.toISOString());
    expect(second.partialFailures).toEqual([
      { at: later.toISOString(), source: 'api', reason: 'GitHub API 502 Bad Gateway' },
      { at: later.toISOString(), source: 'html', reason: 'rate limited' },
    ]);
    expect(await readFile(recordPath, 'utf8')).toBe(RECORD);
  });

  it('rewrites a byte-identical cache file for identical input', async () => {
    const sync = () =>
      runGithubSync({
        cwd,
        config,
        fetchMetadata: async () => metadata,
        now: () => at,
        log: () => {},
      });
    await sync();
    const first = await readFile(join(cwd, 'data', 'cache', 'github', 'demo.json'), 'utf8');
    await sync();
    expect(await readFile(join(cwd, 'data', 'cache', 'github', 'demo.json'), 'utf8')).toBe(first);
    expect(first.endsWith('\n')).toBe(true);
  });
});

describe('migrateGithubCache', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-migrate-cache-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await writeFile(join(cwd, 'data', 'records', 'demo.yml'), RECORD);
    await writeFile(join(cwd, 'data', 'records', 'plain.yml'), 'kind: project\nname: Plain\n');
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('reports without writing in check mode', async () => {
    const run = await migrateGithubCache({ cwd, config, write: false });
    expect(run.migrated).toEqual(['demo']);
    expect(await readFile(join(cwd, 'data', 'records', 'demo.yml'), 'utf8')).toBe(RECORD);
    expect(await readdir(join(cwd, 'data')).then((d) => d.includes('cache'))).toBe(false);
  });

  it('moves inline blocks into the cache, then has nothing left to do', async () => {
    const run = await migrateGithubCache({ cwd, config, write: true });
    expect(run.migrated).toEqual(['demo']);
    expect(await readFile(join(cwd, 'data', 'records', 'demo.yml'), 'utf8')).toBe(
      '# curator comment\nkind: project\nslug: demo\nname: Demo\nrepoUrl: https://github.com/owner/demo\n',
    );
    expect(await readFile(join(cwd, 'data', 'records', 'plain.yml'), 'utf8')).toBe(
      'kind: project\nname: Plain\n',
    );
    expect(await readdir(join(cwd, 'data', 'cache', 'github'))).toEqual(['demo.json']);
    const again = await migrateGithubCache({ cwd, config, write: true });
    expect(again.migrated).toEqual([]);
  });
});
