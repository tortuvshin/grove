import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  type AwesomeReadmeCategory,
  type AwesomeReadmeRecord,
  buildAwesomeReadme,
  decisionsFileSchema,
  type GroveConfig,
  healthFileSchema,
  injectAwesomeReadmeBlock,
  loadConfig,
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

      const markdown = buildAwesomeReadme({
        site: {
          name: config.site.name,
          ...(config.site.tagline ? { tagline: config.site.tagline } : {}),
          ...(config.site.description ? { description: config.site.description } : {}),
          ...(config.site.url ? { url: config.site.url } : {}),
          ...(config.site.repoUrl ? { repoUrl: config.site.repoUrl } : {}),
        },
        categories,
        records,
        generatedAt: new Date().toISOString(),
        readme: config.readme,
      });

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
 * Resolve effective visibility the same way the build does.
 *
 * This command used to read only the record's own top-level
 * `visibility:` field. For project records that field is not the
 * signal the site uses — `health.visibility` is, and a
 * `data/decisions.yml` entry overrides both. The result was that a
 * record hidden by a curator decision still shipped in the generated
 * README. Precedence here matches `generate()` in
 * `@grove-dev/core`: decision, then inline health, then health.yml,
 * then the record's own field.
 */
async function loadVisibilityResolver(
  cwd: string,
  config: GroveConfig,
): Promise<(slug: string, raw: Record<string, unknown>) => string | undefined> {
  const decisions = new Map<string, string>();
  try {
    const parsed = decisionsFileSchema.parse(
      parseYaml(await readFile(resolve(cwd, config.paths.decisions), 'utf8')) ?? {},
    );
    const list = Array.isArray(parsed) ? parsed : parsed.decisions;
    for (const d of list) decisions.set(d.id, d.decision.visibility);
  } catch {
    // missing or invalid decisions.yml → no overrides
  }

  const health = new Map<string, string>();
  try {
    const parsed = healthFileSchema.parse(
      parseYaml(await readFile(resolve(cwd, config.paths.health), 'utf8')) ?? {},
    );
    const list = Array.isArray(parsed) ? parsed : parsed.health;
    for (const e of list) health.set(e.id, e.health.visibility);
  } catch {
    // missing or invalid health.yml → no entries
  }

  return (slug, raw) => {
    const decided = decisions.get(slug);
    if (decided) return decided;
    const inline = (raw.health as { visibility?: string } | undefined)?.visibility;
    if (inline) return inline;
    const fromFile = health.get(slug);
    if (fromFile) return fromFile;
    return typeof raw.visibility === 'string' ? (raw.visibility as string) : undefined;
  };
}

async function loadRecords(cwd: string, config: GroveConfig): Promise<AwesomeReadmeRecord[]> {
  const dir = resolve(cwd, config.paths.recordsDir);
  const resolveVisibility = await loadVisibilityResolver(cwd, config);
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort();
  const out: AwesomeReadmeRecord[] = [];
  for (const file of files) {
    const raw = (parseYaml(await readFile(join(dir, file), 'utf8')) ?? {}) as Record<
      string,
      unknown
    >;
    const github = (raw.github as Record<string, unknown> | undefined) ?? {};
    const repoMeta = (github.repository as Record<string, unknown> | undefined) ?? {};
    const links = (raw.links as Record<string, string> | undefined) ?? {};
    const stars =
      typeof github.stars === 'number'
        ? (github.stars as number)
        : typeof repoMeta.stargazers_count === 'number'
          ? (repoMeta.stargazers_count as number)
          : undefined;
    const license = typeof github.license === 'string' ? (github.license as string) : undefined;
    out.push({
      slug: typeof raw.slug === 'string' ? (raw.slug as string) : '',
      name: typeof raw.name === 'string' ? (raw.name as string) : undefined,
      description: typeof raw.description === 'string' ? (raw.description as string) : undefined,
      category: typeof raw.category === 'string' ? (raw.category as string) : undefined,
      repoUrl:
        typeof raw.repoUrl === 'string' ? (raw.repoUrl as string) : (links.github ?? undefined),
      homepageUrl:
        typeof raw.homepageUrl === 'string'
          ? (raw.homepageUrl as string)
          : (links.website ?? undefined),
      visibility: resolveVisibility(
        typeof raw.slug === 'string' ? (raw.slug as string) : file.replace(/\.ya?ml$/, ''),
        raw,
      ),
      ...(stars !== undefined ? { stars } : {}),
      ...(license !== undefined ? { license } : {}),
    });
  }
  return out;
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
