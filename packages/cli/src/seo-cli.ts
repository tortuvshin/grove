import { checkBuiltSite, loadConfig } from '@grove-dev/core';
import { Command } from 'commander';

/**
 * `grove seo` — crawl the built site for cross-page SEO mistakes
 * (duplicate titles, canonical and sitemap disagreements, pages whose
 * robots meta contradicts the index policy, retired brand names).
 * Run it after the build: `pnpm build && grove seo`.
 */
export function buildSeoCommand(): Command {
  return new Command('seo')
    .description('Check the built site for cross-page SEO mistakes. Run after the build.')
    .option('--dist <dir>', 'built site directory', 'dist')
    .option('--quiet', 'print errors only')
    .action(async (opts: { dist: string; quiet?: boolean }) => {
      const config = await loadConfig();
      const result = await checkBuiltSite({
        distDir: opts.dist,
        generatedDir: config.paths.generatedDir,
        retiredBrands: config.seo.retiredBrands,
      });
      if (!opts.quiet) for (const w of result.warnings) console.warn(`warn  ${w}`);
      for (const e of result.errors) console.error(`error ${e}`);
      const checked = Object.entries(result.checked)
        .map(([type, n]) => `${n} ${type}`)
        .join(', ');
      console.log(
        `[seo] ${result.indexable} indexable, ${result.noindex} noindex (${result.policyNoindex} by policy); ` +
          `checked ${checked || 'nothing'}; ${result.errors.length} error(s), ${result.warnings.length} warning(s).`,
      );
      if (result.errors.length > 0) process.exitCode = 1;
    });
}
