import { access, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import {
  blueprintKind,
  type GroveConfig,
  loadConfig,
  loadGithubCache,
  migrateRecordGithub,
  splitFrontmatter,
  writeGithubCacheEntry,
  yamlRecordToMarkdown,
} from '@grove-dev/core';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';

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

export interface MarkdownRecordsMigrationRun {
  /** Records converted (or, with `write: false`, that would be), in file order. */
  migrated: Array<{
    slug: string;
    /** The YAML record, relative to `cwd`. */
    from: string;
    /** The Markdown record, relative to `cwd`. */
    to: string;
    /** True when the record had a body (the `.md` already existed). */
    body: boolean;
    /** Top-level fields left out because the normalizer derives them. */
    dropped: string[];
  }>;
  /** Records left as YAML, and why. */
  refused: Array<{ slug: string; file: string; reason: string }>;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

/**
 * Convert every YAML record (`paths.recordsDir/<slug>.yml`) into a
 * Markdown record (`paths.bodiesDir/<slug>.md`): YAML frontmatter, then
 * the body its `content:` pointer names, byte-for-byte. A record is
 * refused, and left as it is, when its target `.md` exists but is not
 * its own body, when its body lives somewhere else or has frontmatter
 * of its own, or when {@link yamlRecordToMarkdown} refuses it. The
 * Markdown file is written before the YAML is deleted, so an
 * interrupted run leaves a `duplicate_slug_format` error, never a lost
 * record.
 */
export async function migrateMarkdownRecords(options: {
  cwd: string;
  config: GroveConfig;
  write: boolean;
}): Promise<MarkdownRecordsMigrationRun> {
  const { cwd, config, write } = options;
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const bodiesDir = resolve(cwd, config.paths.bodiesDir ?? 'content/records');
  const kind = blueprintKind[config.blueprint];
  const labelKey = kind === 'resource' ? 'title' : 'name';
  const files = (await readdir(recordsDir).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.yml'))
    .sort();
  const run: MarkdownRecordsMigrationRun = { migrated: [], refused: [] };
  for (const file of files) {
    const slug = basename(file, '.yml');
    const path = join(recordsDir, file);
    const target = join(bodiesDir, `${slug}.md`);
    const refuse = (reason: string) =>
      run.refused.push({ slug, file: relative(cwd, path), reason });
    const text = await readFile(path, 'utf8');
    let pointer: unknown;
    try {
      pointer = (parseYaml(text, { schema: 'core' }) as { content?: unknown } | null)?.content;
    } catch (err) {
      refuse(`YAML does not parse: ${(err as Error).message}`);
      continue;
    }
    let body = '';
    if (typeof pointer === 'string' && pointer) {
      // Resolved the way the normalizer resolves it.
      const candidates = [resolve(cwd, pointer), resolve(cwd, 'apps', 'example', pointer)];
      let found: string | undefined;
      for (const candidate of candidates) {
        if (await exists(candidate)) {
          found = candidate;
          break;
        }
      }
      if (!found) {
        refuse(`content "${pointer}" does not resolve to a file`);
        continue;
      }
      if (found !== target) {
        refuse(
          `its body is ${relative(cwd, found)}, not ${relative(cwd, target)}; move the body there first`,
        );
        continue;
      }
      body = await readFile(found, 'utf8');
      if (splitFrontmatter(body).hasFrontmatter) {
        refuse(`${relative(cwd, found)} already has frontmatter; merge it by hand`);
        continue;
      }
    } else if (await exists(target)) {
      // Some other document (or a body no record points at) owns the name.
      refuse(`${relative(cwd, target)} already exists and is not this record's body`);
      continue;
    }
    const result = yamlRecordToMarkdown(slug, text, { kind, labelKey, body });
    if (!result.ok) {
      refuse(result.reason);
      continue;
    }
    run.migrated.push({
      slug,
      from: relative(cwd, path),
      to: relative(cwd, target),
      body: body !== '',
      dropped: result.dropped,
    });
    if (!write) continue;
    await writeFile(target, result.text, 'utf8');
    await unlink(path);
  }
  return run;
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

  cmd
    .command('markdown-records')
    .description(
      'Turn each YAML record (and its content: body) into one Markdown record in paths.bodiesDir.',
    )
    .option(
      '--check',
      'Write nothing; list what would change and exit 1 while YAML records remain.',
    )
    .action(async (opts: { check?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const run = await migrateMarkdownRecords({ cwd, config, write: !opts.check });
      const verb = opts.check ? 'would move' : 'moved';
      for (const entry of run.migrated) {
        const dropped = entry.dropped.length > 0 ? ` (dropped ${entry.dropped.join(', ')})` : '';
        console.log(`[migrate markdown-records] ${entry.from} → ${entry.to}${dropped}`);
      }
      for (const { file, reason } of run.refused) {
        console.warn(`[migrate markdown-records] kept ${file}: ${reason}`);
      }
      console.log(
        `[migrate markdown-records] ${verb} ${run.migrated.length} record(s) to Markdown; ${run.refused.length} left as YAML.`,
      );
      if (run.refused.length > 0 || (opts.check && run.migrated.length > 0)) process.exitCode = 1;
    });

  return cmd;
}
