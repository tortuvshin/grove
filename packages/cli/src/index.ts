#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import {
  cleanupStale,
  loadConfig,
  normalizeGithubIntegration,
  prepareDirectory,
  syncContributors,
  validateProject,
} from '@grove-dev/core';
import { Command } from 'commander';
import { buildAuditCommand } from './audit-cli.js';
import { buildCollectionCommand } from './collection-cli.js';
import { buildHealthCommand } from './health-cli.js';
import { buildIconsCommand } from './icons-cli.js';
import { buildImportCommand } from './import-cli.js';
import { initDirectory, readCliVersion } from './init.js';
import { buildMigrateCommand } from './migrate-cli.js';
import {
  detectPackageManager,
  installCommand,
  localBin,
  runScriptCommand,
} from './package-manager.js';
import { buildReadmeCommand } from './readme-cli.js';
import { run } from './run.js';
import { runGithubSync } from './sync-github.js';
import { appendSyncStepSummary, formatSyncSummaryText, syncExitCode } from './sync-summary.js';
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
  .description('Refresh GitHub metadata owned by Grove into the sync cache (paths.githubCache).')
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

    const { outcomes, inlineRecords, cacheDir } = await runGithubSync({
      cwd: process.cwd(),
      config,
      ...(options.limit === undefined ? {} : { limit: options.limit }),
    });
    console.log(`[sync github] cache → ${relative(process.cwd(), cacheDir) || '.'}`);
    if (inlineRecords.length > 0) {
      // The cache wins over these, and `grove check` warns where they
      // disagree; migrating removes the second copy for good.
      console.log(
        `[sync github] ${inlineRecords.length} record(s) still carry inline github/health — run \`grove migrate github-cache\` to move them into the cache.`,
      );
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
program.addCommand(buildMigrateCommand());
program.addCommand(buildReadmeCommand());

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
