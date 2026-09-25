#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  buildGithubSyncPatch,
  classifyHealth,
  cleanupStale,
  enrichFromGithubHtml,
  fetchGithubMetadata,
  type HealthEntry,
  loadConfig,
  normalizeGithubIntegration,
  parseGithubRepoUrl,
  prepareDirectory,
  pruneLegacyGithubFields,
  stringifyRecordYaml,
  syncContributors,
  validateProject,
} from '@grove-dev/core';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';
import { buildAuditCommand } from './audit-cli.js';
import { buildCollectionCommand } from './collection-cli.js';
import { buildHealthCommand } from './health-cli.js';
import { buildIconsCommand } from './icons-cli.js';
import { buildImportCommand } from './import-cli.js';
import { initDirectory, readCliVersion } from './init.js';
import {
  detectPackageManager,
  installCommand,
  localBin,
  runScriptCommand,
} from './package-manager.js';
import { buildReadmeCommand } from './readme-cli.js';
import { run } from './run.js';
import {
  appendSyncStepSummary,
  formatSyncSummaryText,
  type SyncOutcome,
  shortReason,
  syncExitCode,
} from './sync-summary.js';
import { formatPlan, runUpdate } from './update.js';

const program = new Command();

program
  .name('grove')
  .description('Build and maintain a Grove-powered directory.')
  .version(readCliVersion());

program
  .command('init')
  .argument('[directory]', 'directory to create', '.')
  .description('Create a Grove project by installing the @grove/default registry scaffold.')
  .option(
    '--no-install',
    "skip the final dependency install (the scaffold's own npm dependencies are recorded in package.json either way)",
  )
  .option('--no-git', 'skip git init')
  .action(async (directory: string, options: { install: boolean; git: boolean }) => {
    const target = resolve(process.cwd(), directory);
    const result = await initDirectory(target, {
      ...(directory === '.' ? {} : { projectName: basename(resolve(directory)) }),
    });
    console.log(`Created ${result.projectName} in ${result.targetDir}`);
    // Whatever scaffolded the project finishes it: `grove init` picked
    // the package manager from the user's own environment, and every
    // instruction from here on has to name that same one.
    const pm = result.packageManager;
    if (options.install) await run(...installCommand(pm), target);
    if (options.git) await run('git', ['init'], target);
    console.log(`\nNext:\n  cd ${directory}\n  ${runScriptCommand(pm, 'dev')}`);
  });

program
  .command('check')
  .description('Validate data, generate artifacts, and run Astro checks.')
  .option('--strict', 'treat Grove warnings as errors')
  .action(async (options: { strict?: boolean }) => {
    const config = await loadConfig();
    const result = await validateProject(config, {
      ...(options.strict === undefined ? {} : { strict: options.strict }),
    });
    for (const issue of result.issues) {
      const output = issue.severity === 'error' ? console.error : console.warn;
      output(`[${issue.severity}] ${issue.code}: ${issue.message}`);
    }
    if (!result.ok || (options.strict && result.warnings.length > 0)) {
      process.exitCode = 1;
      return;
    }
    const prepared = await prepareDirectory();
    console.log(
      `[grove] ${prepared.generated.totalRecords} records prepared; sitemap and llms files updated.`,
    );
    // astro is installed in the project; run it straight from
    // node_modules/.bin. Going through a package manager here used to
    // mean `grove check` died with `spawn pnpm ENOENT` for anyone who
    // had installed with npm, yarn or bun.
    const astro = localBin(process.cwd(), 'astro');
    if (!existsSync(astro)) {
      throw new Error(
        `astro is not installed in ${process.cwd()} — run \`${installCommand(detectPackageManager())[0]} install\` first.`,
      );
    }
    await run(astro, ['check']);
  });

program
  .command('sync')
  .argument('<target>', 'github | contributors')
  .description('Refresh GitHub metadata owned by Grove.')
  .option('--limit <count>', 'limit records to sync', Number)
  .option(
    '--strict',
    'exit non-zero if any record could not be refreshed from either the API or the HTML fallback',
  )
  .action(async (target: string, options: { limit?: number; strict?: boolean }) => {
    const config = await loadConfig();
    const githubFlags = normalizeGithubIntegration(config.integrations?.github);
    if (target === 'contributors') {
      if (!githubFlags.contributors) {
        console.log('[sync contributors] disabled by integrations.github.contributors — skipping');
        return;
      }
      await prepareDirectory();
      const result = await syncContributors({
        cwd: process.cwd(),
        generatedDir: config.paths.generatedDir,
        ...(config.site.repoUrl ? { repoUrl: config.site.repoUrl } : {}),
      });
      console.log(
        `[sync contributors] ${result.contributors} contributors from ${result.repositories} repository → ${result.outputPath}`,
      );
      return;
    }
    if (target !== 'github') {
      throw new Error(`Unknown sync target "${target}". Use github or contributors.`);
    }
    if (!githubFlags.metadata) {
      console.log('[sync github] disabled by integrations.github.metadata — skipping');
      return;
    }

    const recordsDir = resolve(process.cwd(), config.paths.recordsDir);
    const files = (await readdir(recordsDir)).filter((file) => file.endsWith('.yml')).sort();
    const selected = options.limit === undefined ? files : files.slice(0, options.limit);
    const outcomes: SyncOutcome[] = [];

    for (const file of selected) {
      const filePath = join(recordsDir, file);
      const raw = (parseYaml(await readFile(filePath, 'utf8')) ?? {}) as Record<string, unknown>;
      const links = (raw.links as Record<string, string> | undefined) ?? {};
      const repoUrl = (raw.repoUrl as string | undefined) ?? links.github;
      if (!repoUrl) {
        console.log(`[sync github] ${file}: no repository, skipped`);
        continue;
      }
      const ref = parseGithubRepoUrl(repoUrl);
      if (!ref) {
        console.log(`[sync github] ${file}: invalid GitHub URL, skipped`);
        continue;
      }

      const slug = basename(file, '.yml');
      const github = (raw.github as Record<string, unknown> | undefined) ?? {};
      const patch: Record<string, unknown> = {};
      // Health is written inline onto the record (not to a shared
      // data/health.yml) so two records syncing at once never touch
      // the same file.
      let health: HealthEntry['health'] | undefined;
      let source: 'api' | 'html' | undefined;
      // Why the API path didn't deliver, then why the fallback didn't —
      // reported per record at the end instead of swallowed.
      const reasons: string[] = [];
      try {
        const metadata = await fetchGithubMetadata(ref);
        if (metadata) {
          if (githubFlags.health) {
            health = classifyHealth(slug, metadata).health;
          }
          // Merge into the existing repository block rather than
          // replacing it wholesale. Sync only owns the fields it
          // explicitly writes; curator-curated fields and anything
          // outside the sync surface (manually-added metadata, etc.)
          // survive a re-run.
          Object.assign(patch, buildGithubSyncPatch(metadata, github));
          source = 'api';
        } else {
          reasons.push('API: repository not found');
        }
      } catch (error) {
        // The token-free HTML fallback below keeps scheduled syncs useful.
        reasons.push(`API: ${shortReason(error)}`);
      }
      if (!source) {
        try {
          const enriched = await enrichFromGithubHtml(repoUrl);
          if (!enriched.notFound && !enriched.rateLimited && !enriched.error) {
            // HTML fallback only fills fields the API didn't reach.
            // `homepage` is the only field unique to the HTML path;
            // it lives at `github.homepage` (flat, matches schema).
            if (enriched.fields.homepage) {
              patch.homepage = enriched.fields.homepage;
            }
            patch.html = {
              license: enriched.fields.license,
              language: enriched.fields.language,
              topics: enriched.fields.topics,
            };
            source = 'html';
          } else {
            reasons.push(
              `HTML: ${enriched.notFound ? 'not found' : enriched.rateLimited ? 'rate limited' : shortReason(enriched.error)}`,
            );
          }
        } catch (error) {
          // Report the record once both metadata sources have failed.
          reasons.push(`HTML: ${shortReason(error)}`);
        }
      }
      const reason = reasons.length > 0 ? reasons.join('; ') : undefined;
      if (!source) {
        outcomes.push({ slug, outcome: 'failed', ...(reason ? { reason } : {}) });
        console.log(`[sync github] ${file}: unavailable`);
        continue;
      }
      patch.sync = { syncedAt: new Date().toISOString(), source };
      await writeFile(
        filePath,
        stringifyRecordYaml({
          ...raw,
          ...(health ? { health } : {}),
          github: { ...pruneLegacyGithubFields(github), ...patch },
        }),
        'utf8',
      );
      outcomes.push({ slug, outcome: source, ...(reason ? { reason } : {}) });
      console.log(`[sync github] ${file}: ${source}`);
    }
    console.log(formatSyncSummaryText(outcomes));
    await appendSyncStepSummary(outcomes);
    if (syncExitCode(outcomes, options.strict ?? false) !== 0) process.exitCode = 1;
  });

program
  .command('cleanup')
  .description('Write a report of records that need human review.')
  .option('--strict', 'fail when review candidates exist')
  .action(async (options: { strict?: boolean }) => {
    const { report, path } = await cleanupStale();
    console.log(`[cleanup] ${report.totalCandidates} candidate(s) → ${path}`);
    for (const candidate of report.candidates.slice(0, 10)) {
      console.log(`  - ${candidate.slug} (${candidate.status}, ${candidate.stars}★)`);
    }
    if (options.strict && report.totalCandidates > 0) process.exitCode = 1;
  });

program
  .command('update')
  .description(
    "Reconcile the consumer's installed scaffold against the registry upstream. " +
      'Never overwrites locally modified files.',
  )
  .option(
    '--adopt',
    'write .grove/registry.lock.json from what is on disk when the project has none ' +
      '(local edits are preserved; nothing is overwritten)',
  )
  .option('--check', 'print the plan only; exit non-zero if anything needs applying')
  .option('--diff', 'include a unified diff for every upstream_changed row')
  .option(
    '--force',
    'apply changes even when conflicts exist (locally-modified is still preserved)',
  )
  .option('--json', 'emit a machine-readable JSON summary')
  .option(
    '--from <path-or-url>',
    'upstream default.json to compare against (defaults to the @grove registry in components.json)',
  )
  .action(
    async (options: {
      adopt?: boolean;
      check?: boolean;
      diff?: boolean;
      force?: boolean;
      json?: boolean;
      from?: string;
    }) => {
      const summary = await runUpdate({
        cwd: process.cwd(),
        adopt: options.adopt === true,
        check: options.check === true,
        diff: options.diff === true,
        force: options.force === true,
        json: options.json === true,
        ...(options.from === undefined ? {} : { from: options.from }),
      });
      if (summary.exitCode === 1) {
        console.error(
          'No .grove/registry.lock.json found.\n' +
            'For a project Grove already powers, run `grove update --adopt` to write one\n' +
            'from the files on disk. For a new project, run `grove init`.',
        );
        process.exitCode = 1;
        return;
      }
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              ...(summary.adopted ? { adopted: true } : {}),
              plan: summary.plan,
              applied: summary.applied,
              preserved: summary.preserved,
              ...(summary.diffs.length > 0 ? { diffs: summary.diffs } : {}),
            },
            null,
            2,
          ),
        );
      } else {
        console.log(formatPlan(summary));
      }
      if (summary.exitCode !== 0) process.exitCode = summary.exitCode;
    },
  );

program.addCommand(buildAuditCommand());
program.addCommand(buildCollectionCommand());
program.addCommand(buildHealthCommand());
program.addCommand(buildIconsCommand());
program.addCommand(buildImportCommand());
program.addCommand(buildReadmeCommand());

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
