import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type AwesomeReadmeCategory,
  type AwesomeReadmeRecord,
  buildAwesomeReadme,
  directoryRoute,
  type GroveConfig,
  injectAwesomeReadmeBlock,
  loadConfig,
  loadNormalizedRecords,
  toAwesomeReadmeRecord,
} from '@grove-dev/core';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';

const DEFAULT_README_PATH = 'README.md';

export function buildReadmeCommand(): Command {
  const cmd = new Command('readme');
  cmd.description('Generate an awesome-list formatted README from data/records/.');

  cmd
    .command('generate')
    .description('Render the README into the grove-managed sentinel block.')
    .option('--stdout', 'Print to stdout instead of writing to README.md (for CI dry-runs).')
    .option('--path <path>', 'README path relative to cwd', DEFAULT_README_PATH)
    .option('--check', 'Exit with code 1 when the rendered block differs from the existing README.')
    .action(async (opts: { stdout?: boolean; path: string; check?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const records = await loadRecords(cwd, config);
      const categories = await loadCategories(cwd, config.paths.taxonomyDir);

      let markdown: string;
      try {
        markdown = buildAwesomeReadme({
          site: {
            name: config.site.name,
            ...(config.site.tagline ? { tagline: config.site.tagline } : {}),
            ...(config.site.description ? { description: config.site.description } : {}),
            ...(config.site.url ? { url: config.site.url } : {}),
            ...(config.site.repoUrl ? { repoUrl: config.site.repoUrl } : {}),
          },
          directoryRoute: directoryRoute(config),
          categories,
          records,
          generatedAt: new Date().toISOString(),
          readme: config.readme,
        });
      } catch (error) {
        console.error(`[grove readme] ${(error as Error).message}`);
        process.exitCode = 1;
        return;
      }

      if (opts.stdout) {
        process.stdout.write(markdown);
        return;
      }

      const readmePath = resolve(cwd, opts.path);
      const existing = await safeRead(readmePath);
      const rendered = injectAwesomeReadmeBlock(existing, markdown);

      if (opts.check) {
        if (rendered !== existing) {
          console.error(
            `[grove readme] ${opts.path} is out of date. Run 'grove readme generate' to update.`,
          );
          process.exitCode = 1;
          return;
        }
        console.log(`[grove readme] ${opts.path} is up to date.`);
        return;
      }

      await writeFile(readmePath, rendered, 'utf8');
      console.log(
        `[grove readme] wrote ${opts.path} (${records.length} records, ${categories.length} categories)`,
      );
    });

  return cmd;
}

async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

/**
 * README entries come from the shared record normalizer — the same
 * records, with the same cache / overrides / health.yml / decisions
 * merge and the same effective visibility, that the site is built
 * from. A record hidden on the site is never listed here.
 */
async function loadRecords(cwd: string, config: GroveConfig): Promise<AwesomeReadmeRecord[]> {
  const { records, issues } = await loadNormalizedRecords(config, cwd);
  const failed = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.slug));
  if (failed.size > 0) {
    console.error(
      `[grove readme] skipped ${failed.size} record(s) that fail the schema (${[...failed].join(', ')}); run \`grove check\` for details.`,
    );
  }
  return records.map((entry) => toAwesomeReadmeRecord(entry.record));
}

async function loadCategories(cwd: string, taxonomyDir: string): Promise<AwesomeReadmeCategory[]> {
  const path = resolve(cwd, taxonomyDir, 'categories.yml');
  const raw = (parseYaml(await readFile(path, 'utf8')) ?? []) as Array<Record<string, unknown>>;
  return raw
    .map((entry) => ({
      id: typeof entry.id === 'string' ? (entry.id as string) : '',
      name: typeof entry.name === 'string' ? (entry.name as string) : '',
    }))
    .filter((entry) => entry.id && entry.name);
}
