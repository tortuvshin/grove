import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import {
  type GroveConfig,
  loadConfig,
  loadGithubCache,
  migrateRecordGithub,
  writeGithubCacheEntry,
} from '@grove-dev/core';
import { Command } from 'commander';

export interface GithubCacheMigrationRun {
  /** Slugs whose inline blocks were (or, with `write: false`, would be) moved. */
  migrated: string[];
  /** Records whose inline values disagreed with an existing cache entry (the cache was kept). */
  conflicts: Array<{ slug: string; conflicts: string[] }>;
  cacheDir: string;
}

/**
 * Move every record's inline `github` / `health` into the GitHub sync
 * cache and strip them from the record, leaving the rest of each YAML
 * file byte-for-byte as it was. The cache file is written before the
 * record, so an interrupted run leaves data duplicated, never lost.
 */
export async function migrateGithubCache(options: {
  cwd: string;
  config: GroveConfig;
  write: boolean;
}): Promise<GithubCacheMigrationRun> {
  const { cwd, config, write } = options;
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const files = (await readdir(recordsDir)).filter((file) => file.endsWith('.yml')).sort();
  const cache = await loadGithubCache(config, cwd);
  if (cache.errors.length > 0) {
    // Merging into an entry we could not read would overwrite it.
    const detail = cache.errors.map(({ file, message }) => `${file}: ${message}`).join('; ');
    throw new Error(`cannot migrate while cache files are invalid — ${detail}`);
  }
  const migrated: string[] = [];
  const conflicts: GithubCacheMigrationRun['conflicts'] = [];
  for (const file of files) {
    const slug = basename(file, '.yml');
    const path = join(recordsDir, file);
    const text = await readFile(path, 'utf8');
    const result = migrateRecordGithub(slug, text, cache.entries.get(slug));
    if (!result.entry) continue;
    migrated.push(slug);
    if (result.conflicts.length > 0) conflicts.push({ slug, conflicts: result.conflicts });
    if (!write) continue;
    await writeGithubCacheEntry(cache.dir, result.entry);
    await writeFile(path, result.text, 'utf8');
  }
  return { migrated, conflicts, cacheDir: cache.dir };
}

export function buildMigrateCommand(): Command {
  const cmd = new Command('migrate');
  cmd.description('One-off data migrations between Grove versions.');

  cmd
    .command('github-cache')
    .description(
      'Move inline github/health blocks out of records into the GitHub sync cache (paths.githubCache).',
    )
    .option('--check', 'Write nothing; exit 1 when any record still carries an inline block.')
    .action(async (opts: { check?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const run = await migrateGithubCache({ cwd, config, write: !opts.check });
      const cacheDir = relative(cwd, run.cacheDir) || '.';
      for (const { slug, conflicts } of run.conflicts) {
        console.warn(
          `[migrate github-cache] ${slug}: kept the existing cache entry; dropped inline ${conflicts.join(', ')}`,
        );
      }
      if (opts.check) {
        if (run.migrated.length > 0) {
          console.error(
            `[migrate github-cache] ${run.migrated.length} record(s) carry inline github/health — run 'grove migrate github-cache'.`,
          );
          process.exitCode = 1;
          return;
        }
        console.log('[migrate github-cache] no inline github/health blocks left.');
        return;
      }
      console.log(
        `[migrate github-cache] moved ${run.migrated.length} record(s) into ${cacheDir}/ (${run.conflicts.length} kept an existing cache entry)`,
      );
    });

  return cmd;
}
