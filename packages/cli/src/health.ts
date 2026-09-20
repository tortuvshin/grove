import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type ReadmeHealthReport, runReadmeHealthCheck } from '@grove-dev/core';

export interface HealthCliOptions {
  cwd?: string;
  readme?: string;
  json?: boolean;
}

const AUTO_DETECT_CANDIDATES = ['README.md', 'Readme.md', 'readme.md'];

async function resolveReadmePath(cwd: string, explicit: string | undefined): Promise<string> {
  if (explicit) return resolve(cwd, explicit);
  for (const candidate of AUTO_DETECT_CANDIDATES) {
    const path = resolve(cwd, candidate);
    try {
      await readFile(path, 'utf8');
      return path;
    } catch {
      continue;
    }
  }
  throw new Error(
    `No README found in ${cwd} (looked for ${AUTO_DETECT_CANDIDATES.join(', ')}). ` +
      'Pass an explicit path: grove health <path>',
  );
}

export async function runHealth(opts: HealthCliOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  let readmePath: string;
  try {
    readmePath = await resolveReadmePath(cwd, opts.readme);
  } catch (error) {
    console.error(`[grove health] ${(error as Error).message}`);
    return 1;
  }

  const markdown = await readFile(readmePath, 'utf8');
  const report = await runReadmeHealthCheck(markdown, { file: readmePath });

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(renderReport(report));
  return 0;
}

function renderReport(report: ReadmeHealthReport): string {
  const { summary } = report;
  const lines: string[] = ['Grove Health', ''];
  lines.push(`${summary.entriesDetected} entries detected`);
  lines.push(`${summary.repositoriesResolved} repositories resolved`);

  const confirmed: string[] = [];
  if (summary.archived > 0) confirmed.push(`  ${summary.archived} archived`);
  if (summary.unavailable > 0) confirmed.push(`  ${summary.unavailable} unavailable`);
  if (summary.moved > 0) confirmed.push(`  ${summary.moved} moved`);
  if (summary.duplicates > 0) confirmed.push(`  ${summary.duplicates} duplicates`);
  if (confirmed.length > 0) {
    lines.push('', 'Confirmed issues', ...confirmed);
  }

  const needsReview: string[] = [];
  if (summary.likelyStale > 0) needsReview.push(`  ${summary.likelyStale} likely stale`);
  if (summary.unresolved > 0) needsReview.push(`  ${summary.unresolved} unresolved`);
  if (needsReview.length > 0) {
    lines.push('', 'Needs review', ...needsReview);
  }

  lines.push('', `Healthy / maintained: ${summary.healthyPercent}%`, '');
  return lines.join('\n');
}
