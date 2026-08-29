import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { stringify as yamlStringify } from 'yaml';

export function buildCollectionCommand(): Command {
  const cmd = new Command('collection');
  cmd.description('Curated collection management');

  cmd
    .command('promote')
    .description('Promote a filter URL to a curated collection YAML.')
    .requiredOption(
      '--from <path>',
      'Source filter path, e.g. /browse?stack=flutter&category=finance',
    )
    .requiredOption('--slug <slug>', 'Slug for the new collection')
    .option('--title <title>', 'Title')
    .option('--description <description>', 'Description')
    .action(async (opts) => {
      const params = parseQuery(opts.from);
      const collection = {
        slug: opts.slug,
        kind: 'curated',
        title: opts.title ?? humanize(opts.slug),
        description: opts.description ?? `Curated collection built from ${opts.from}.`,
        query: {
          ...(params.stack ? { stacks: [params.stack] } : {}),
          ...(params.category ? { categories: [params.category] } : {}),
          ...(params.platform ? { platforms: [params.platform] } : {}),
          excludeStatuses: ['archived'],
        },
        ranking: { preset: 'quality' },
        seo: { index: true },
      };
      const out = resolve(process.cwd(), 'data/collections', `${opts.slug}.yml`);
      await mkdir(resolve(process.cwd(), 'data/collections'), { recursive: true });
      await writeFile(out, yamlStringify(collection), 'utf8');
      process.stdout.write(`Wrote ${out}\n`);
    });

  return cmd;
}

export function parseQuery(path: string): Record<string, string> {
  // Use URLSearchParams rather than `?`/`&`/`=` string-splitting so values
  // containing `&`, `=`, `+`, or percent-encoded chars round-trip correctly.
  // The dummy base URL is required by the URL constructor; we only read the
  // search params, so the host is irrelevant.
  const search = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  const sp = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    // Last-write-wins matches the previous behavior of overwriting duplicate
    // keys (the old split-parser only kept the last `k=v` for repeated keys).
    out[k] = v;
  }
  return out;
}

function humanize(slug: string): string {
  return slug
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}
