import { appendFile } from 'node:fs/promises';

/**
 * End-of-run report for `grove sync github`.
 *
 * A record that fails to sync keeps its previous `github` block, so a
 * bare count ("3 failed") left maintainers guessing which records went
 * stale and why. The CLI collects one outcome per record and hands them
 * here; everything below is pure formatting so it can be unit-tested
 * without touching the network.
 */

export type SyncOutcomeKind = 'api' | 'html' | 'failed';

export interface SyncOutcome {
  slug: string;
  outcome: SyncOutcomeKind;
  /** Why the API (and, for failures, the HTML fallback) did not deliver. */
  reason?: string;
}

export interface SyncTotals {
  updated: number;
  html: number;
  failed: number;
}

const MAX_REASON_LENGTH = 160;

/**
 * Turn a thrown value or a fallback result into a one-line reason.
 * Messages come from `fetch` and `githubJson`, which never include the
 * token, but they can be long or multi-line; the table wants one short
 * line per record.
 */
export function shortReason(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value);
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_REASON_LENGTH ? `${line.slice(0, MAX_REASON_LENGTH - 1)}…` : line;
}

export function summarizeSync(outcomes: readonly SyncOutcome[]): SyncTotals {
  const totals: SyncTotals = { updated: 0, html: 0, failed: 0 };
  for (const { outcome } of outcomes) {
    if (outcome === 'failed') totals.failed += 1;
    else {
      totals.updated += 1;
      if (outcome === 'html') totals.html += 1;
    }
  }
  return totals;
}

/**
 * Only fallback and failed rows are reported — a clean run stays one
 * line. Sorted by slug so two runs over the same data print the same
 * table regardless of the order records were processed in.
 */
function problemRows(outcomes: readonly SyncOutcome[]): SyncOutcome[] {
  return outcomes
    .filter((entry) => entry.outcome !== 'api')
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

function outcomeLabel(outcome: SyncOutcomeKind): string {
  return outcome === 'html' ? 'html fallback' : outcome;
}

function totalsLine({ updated, html, failed }: SyncTotals): string {
  return `${updated} updated (${html} HTML fallback), ${failed} failed`;
}

/** Plain-text summary printed at the end of `grove sync github`. */
export function formatSyncSummaryText(outcomes: readonly SyncOutcome[]): string {
  const totals = `[sync github] ${totalsLine(summarizeSync(outcomes))}`;
  const rows = problemRows(outcomes).map((entry) => [
    entry.slug,
    outcomeLabel(entry.outcome),
    entry.reason ?? '',
  ]);
  if (rows.length === 0) return totals;
  const table = [['slug', 'outcome', 'reason'], ...rows];
  const widths = [0, 1].map((column) =>
    Math.max(...table.map((row) => (row[column] ?? '').length)),
  );
  const lines = table.map((row) =>
    [(row[0] ?? '').padEnd(widths[0] ?? 0), (row[1] ?? '').padEnd(widths[1] ?? 0), row[2] ?? '']
      .join('  ')
      .trimEnd(),
  );
  return [totals, ...lines.map((line) => `  ${line}`)].join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/** Markdown version of the same summary, for `$GITHUB_STEP_SUMMARY`. */
export function formatSyncSummaryMarkdown(outcomes: readonly SyncOutcome[]): string {
  const lines = ['### grove sync github', '', `**${totalsLine(summarizeSync(outcomes))}**`];
  const rows = problemRows(outcomes);
  if (rows.length > 0) {
    lines.push('', '| Record | Outcome | Reason |', '| --- | --- | --- |');
    for (const entry of rows) {
      lines.push(
        `| \`${escapeCell(entry.slug)}\` | ${outcomeLabel(entry.outcome)} | ${escapeCell(entry.reason ?? '')} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Append the Markdown summary to the Actions job summary when the
 * runner provides one. Appends, never overwrites: other steps in the
 * same job write to the same file. Returns whether anything was written.
 */
export async function appendSyncStepSummary(
  outcomes: readonly SyncOutcome[],
  summaryPath: string | undefined = process.env.GITHUB_STEP_SUMMARY,
): Promise<boolean> {
  if (!summaryPath) return false;
  await appendFile(summaryPath, `${formatSyncSummaryMarkdown(outcomes)}\n`, 'utf8');
  return true;
}

/** `--strict` turns any failed record into a non-zero exit. */
export function syncExitCode(outcomes: readonly SyncOutcome[], strict: boolean): 0 | 1 {
  return strict && summarizeSync(outcomes).failed > 0 ? 1 : 0;
}
