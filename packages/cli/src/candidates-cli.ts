import {
  type CandidateListing,
  type CandidateRow,
  type ChannelCandidate,
  listRecordCandidates,
  loadConfig,
  type MediaCandidate,
} from '@grove-dev/core';
import { Command } from 'commander';
import { stringify as stringifyYaml } from 'yaml';

function isChannel(row: CandidateRow): row is CandidateRow & { candidate: ChannelCandidate } {
  return row.kind === 'channel';
}

function kilobytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

/** One short line of facts: `fdroid · android · app.id` or `png · 512×512 · 12 KB`. */
export function describeCandidate(row: CandidateRow): string {
  if (isChannel(row)) {
    const c = row.candidate;
    const facts = c.facts as Record<string, unknown>;
    const parts = [c.label, c.platform];
    if (typeof facts.appId === 'string') parts.push(facts.appId);
    if (typeof facts.package === 'string') parts.push(`package ${facts.package}`);
    if (typeof facts.tag === 'string') parts.push(`release ${facts.tag}`);
    if (Array.isArray(facts.assets)) parts.push(facts.assets.join(', '));
    if (facts.match === 'project-name') {
      parts.push(facts.versionMatchesRelease ? 'name match, version matches' : 'name match only');
    }
    return parts.filter(Boolean).join(' · ');
  }
  const m = row.candidate as MediaCandidate;
  const parts: string[] = [];
  if (m.format) parts.push(m.format);
  if (m.width && m.height) parts.push(`${m.width}×${m.height}`);
  if (m.bytes !== undefined) parts.push(kilobytes(m.bytes));
  if (m.locale) parts.push(m.locale);
  return parts.join(' · ');
}

function displayName(row: CandidateRow): string {
  const c = row.candidate as MediaCandidate;
  return c.path ?? row.candidate.url;
}

/** The `candidates:` entry a reviewer pastes into `paths.decisions` to approve a row. */
export function reviewStub(row: CandidateRow, reviewer = '<your handle>'): Record<string, unknown> {
  return {
    id: row.slug,
    kind: row.kind,
    url: row.candidate.url,
    verdict: 'approved',
    reason: '<why this is the app’s own, current asset or channel>',
    reviewedBy: reviewer,
    reviewedAt: '<YYYY-MM-DD>',
    provenance: row.candidate.provenance,
  };
}

function groupBySlug(rows: readonly CandidateRow[]): Map<string, CandidateRow[]> {
  const groups = new Map<string, CandidateRow[]>();
  for (const row of rows) {
    const list = groups.get(row.slug) ?? [];
    list.push(row);
    groups.set(row.slug, list);
  }
  return groups;
}

function summaryLine(listing: CandidateListing, all: boolean): string {
  const records = groupBySlug(listing.rows).size;
  const noun = all ? 'candidate(s)' : 'pending candidate(s)';
  return `${listing.rows.length} ${noun} across ${records} record(s); ${listing.recordsWithCandidates} record(s) have candidates in the sync cache.`;
}

export function formatCandidatesText(listing: CandidateListing, all = false): string {
  const lines: string[] = [];
  for (const [slug, rows] of groupBySlug(listing.rows)) {
    lines.push(`${slug}`);
    for (const row of rows) {
      const status = all ? ` (${row.status})` : '';
      lines.push(
        `  ${row.kind.padEnd(10)} ${describeCandidate(row)}${status}`,
        `  ${''.padEnd(10)} ${row.candidate.url}  [${row.candidate.provenance.source}]`,
      );
    }
  }
  lines.push(summaryLine(listing, all));
  return lines.join('\n');
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Markdown for a review issue: one table per record, then the
 * `candidates:` entries to paste into the decisions file for the rows
 * a maintainer approves (change `verdict` to `rejected` to reject).
 */
export function formatCandidatesMarkdown(listing: CandidateListing, all = false): string {
  const out: string[] = [];
  out.push(`### Channel and media candidates`, '', summaryLine(listing, all), '');
  out.push(
    'Nothing here is published. Approve a row by adding its entry under `candidates:` in the decisions file, then copy the file or channel into the record by hand. Do not hotlink.',
    '',
  );
  for (const [slug, rows] of groupBySlug(listing.rows)) {
    out.push(`#### ${slug}`, '');
    out.push(
      all
        ? '| kind | candidate | facts | source | status |'
        : '| kind | candidate | facts | source |',
    );
    out.push(all ? '|---|---|---|---|---|' : '|---|---|---|---|');
    for (const row of rows) {
      const link = `[${cell(displayName(row))}](${row.candidate.url})`;
      const source = `[${row.candidate.provenance.source}](${row.candidate.provenance.url})`;
      const cols = [row.kind, link, cell(describeCandidate(row)), source];
      if (all) cols.push(row.status);
      out.push(`| ${cols.join(' | ')} |`);
    }
    const pending = rows.filter((row) => row.status === 'pending');
    if (pending.length > 0) {
      out.push(
        '',
        '<details><summary>Decision entries</summary>',
        '',
        '```yaml',
        stringifyYaml(
          { candidates: pending.map((row) => reviewStub(row)) },
          { lineWidth: 0 },
        ).trimEnd(),
        '```',
        '',
        '</details>',
      );
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function buildCandidatesCommand(): Command {
  return new Command('candidates')
    .description(
      'List channel and media candidates from the GitHub sync cache that nobody has approved or rejected yet.',
    )
    .option('--slug <slug>', 'only this record')
    .option('--all', 'include approved, rejected and already-in-record candidates')
    .option('--json', 'machine-readable JSON output')
    .option('--markdown', 'Markdown tables for a review issue')
    .action(async (opts: { slug?: string; all?: boolean; json?: boolean; markdown?: boolean }) => {
      const config = await loadConfig();
      const listing = await listRecordCandidates(config, process.cwd(), {
        ...(opts.slug ? { slug: opts.slug } : {}),
        ...(opts.all ? { all: true } : {}),
      });
      if (listing.decisionsError) {
        console.error(`[candidates] ${config.paths.decisions}: ${listing.decisionsError}`);
        process.exitCode = 1;
      }
      if (opts.json) {
        console.log(JSON.stringify(listing, null, 2));
      } else if (opts.markdown) {
        console.log(formatCandidatesMarkdown(listing, opts.all === true));
      } else {
        console.log(formatCandidatesText(listing, opts.all === true));
      }
    });
}
