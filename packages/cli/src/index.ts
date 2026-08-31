#!/usr/bin/env node

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
  stringifyRecordYaml,
  syncContributors,
  validateProject,
} from '@grove-dev/core';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';
import { buildAuditCommand } from './audit-cli.js';
import { buildCollectionCommand } from './collection-cli.js';
import { buildIconsCommand } from './icons-cli.js';
import { buildImportCommand } from './import-cli.js';
import { initDirectory, readCliVersion } from './init.js';
import { buildReadmeCommand } from './readme-cli.js';
import { run } from './run.js';
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
    "skip the final pnpm install (shadcn still installs the scaffold's own npm dependencies)",
  )
  .option('--no-git', 'skip git init')
  .action(async (directory: string, options: { install: boolean; git: boolean }) => {
    const target = resolve(process.cwd(), directory);
    const result = await initDirectory(target, {
      ...(directory === '.' ? {} : { projectName: basename(resolve(directory)) }),
    });
    console.log(`Created ${result.projectName} in ${result.targetDir}`);
    if (options.install) await run('pnpm', ['install'], target);
    if (options.git) await run('git', ['init'], target);
    console.log(`\nNext:\n  cd ${directory}\n  pnpm dev`);
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
    await run('pnpm', ['exec', 'astro', 'check']);
  });

program
  .command('sync')
  .argument('<target>', 'github | contributors')
  .description('Refresh GitHub metadata owned by Grove.')
  .option('--limit <count>', 'limit records to sync', Number)
  .option('--strict', 'fail if any GitHub record cannot be refreshed')
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
    let updated = 0;
    let htmlOnly = 0;
    let failed = 0;
    // `integrations.github.health` used to resolve to a flag nothing
    // read. When it is on, derive a health entry per record from the
    // metadata this sync just fetched and write data/health.yml —
    // the file `grove check` already validates and the build reads.
    const healthEntries: HealthEntry[] = [];

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

      const github = (raw.github as Record<string, unknown> | undefined) ?? {};
      const patch: Record<string, unknown> = {};
      let source: 'api' | 'html' | undefined;
      try {
        const metadata = await fetchGithubMetadata(ref);
        if (metadata) {
          if (githubFlags.health) {
            healthEntries.push(classifyHealth(basename(file, '.yml'), metadata));
          }
          // Merge into the existing repository block rather than
          // replacing it wholesale. Sync only owns the fields it
          // explicitly writes; curator-curated fields and anything
          // outside the sync surface (manually-added metadata, etc.)
          // survive a re-run.
          Object.assign(patch, buildGithubSyncPatch(metadata, github));
          source = 'api';
        }
      } catch {
        // The token-free HTML fallback below keeps scheduled syncs useful.
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
            htmlOnly += 1;
          }
        } catch {
          // Report the record once both metadata sources have failed.
        }
      }
      if (!source) {
        failed += 1;
        console.log(`[sync github] ${file}: unavailable`);
        continue;
      }
      patch.sync = { syncedAt: new Date().toISOString(), source };
      await writeFile(
        filePath,
        stringifyRecordYaml({ ...raw, github: { ...github, ...patch } }),
        'utf8',
      );
      updated += 1;
      console.log(`[sync github] ${file}: ${source}`);
    }
    if (githubFlags.health && healthEntries.length > 0) {
      const healthPath = resolve(process.cwd(), config.paths.health);
      await writeFile(
        healthPath,
        stringifyRecordYaml({ health: healthEntries } as unknown as Record<string, unknown>),
        'utf8',
      );
      console.log(`[sync github] ${healthEntries.length} health entries → ${config.paths.health}`);
    }
    console.log(`[sync github] ${updated} updated (${htmlOnly} HTML fallback), ${failed} failed`);
    if (options.strict && failed > 0) process.exitCode = 1;
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
      check?: boolean;
      diff?: boolean;
      force?: boolean;
      json?: boolean;
      from?: string;
    }) => {
      const summary = await runUpdate({
        cwd: process.cwd(),
        check: options.check === true,
        diff: options.diff === true,
        force: options.force === true,
        json: options.json === true,
        ...(options.from === undefined ? {} : { from: options.from }),
      });
      if (summary.exitCode === 1) {
        console.error('No .grove/registry.lock.json found. Run `grove init` first.');
        process.exitCode = 1;
        return;
      }
      if (options.json) {
        console.log(
          JSON.stringify(
            {
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
program.addCommand(buildIconsCommand());
program.addCommand(buildImportCommand());
program.addCommand(buildReadmeCommand());

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
