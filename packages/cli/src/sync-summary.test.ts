import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendSyncStepSummary,
  formatSyncSummaryMarkdown,
  formatSyncSummaryText,
  type SyncOutcome,
  shortReason,
  summarizeSync,
  syncExitCode,
} from './sync-summary.js';

const clean: SyncOutcome[] = [
  { slug: 'astro', outcome: 'api' },
  { slug: 'ollama', outcome: 'api' },
];

// Deliberately out of slug order: the report must sort it.
const mixed: SyncOutcome[] = [
  { slug: 'zed', outcome: 'failed', reason: 'API: GitHub API 502 Bad Gateway; HTML: not found' },
  { slug: 'astro', outcome: 'api' },
  { slug: 'bun', outcome: 'html', reason: 'API: GitHub API rate limit reached' },
  { slug: 'deno', outcome: 'failed', reason: 'API: fetch failed; HTML: rate limited' },
];

describe('sync github summary', () => {
  it('keeps a clean run to the totals line', () => {
    expect(summarizeSync(clean)).toEqual({ updated: 2, html: 0, failed: 0 });
    expect(formatSyncSummaryText(clean)).toBe(
      '[sync github] 2 updated (0 HTML fallback), 0 failed',
    );
    expect(formatSyncSummaryMarkdown(clean)).toBe(
      '### grove sync github\n\n**2 updated (0 HTML fallback), 0 failed**\n',
    );
  });

  it('lists only fallback and failed records, sorted by slug', () => {
    expect(summarizeSync(mixed)).toEqual({ updated: 2, html: 1, failed: 2 });
    expect(formatSyncSummaryText(mixed)).toBe(
      [
        '[sync github] 2 updated (1 HTML fallback), 2 failed',
        '  slug  outcome        reason',
        '  bun   html fallback  API: GitHub API rate limit reached',
        '  deno  failed         API: fetch failed; HTML: rate limited',
        '  zed   failed         API: GitHub API 502 Bad Gateway; HTML: not found',
      ].join('\n'),
    );
    expect(formatSyncSummaryMarkdown(mixed)).toBe(
      [
        '### grove sync github',
        '',
        '**2 updated (1 HTML fallback), 2 failed**',
        '',
        '| Record | Outcome | Reason |',
        '| --- | --- | --- |',
        '| `bun` | html fallback | API: GitHub API rate limit reached |',
        '| `deno` | failed | API: fetch failed; HTML: rate limited |',
        '| `zed` | failed | API: GitHub API 502 Bad Gateway; HTML: not found |',
        '',
      ].join('\n'),
    );
    // Formatting never reorders the caller's array.
    expect(mixed[0]?.slug).toBe('zed');
  });

  it('escapes pipes so a reason cannot break the Markdown table', () => {
    const markdown = formatSyncSummaryMarkdown([
      { slug: 'a', outcome: 'failed', reason: 'API: a | b' },
    ]);
    expect(markdown).toContain('| `a` | failed | API: a \\| b |');
  });

  it('shortens reasons to one bounded line', () => {
    expect(shortReason(new Error('GitHub API 500\n  Internal   Server Error'))).toBe(
      'GitHub API 500 Internal Server Error',
    );
    const long = shortReason('x'.repeat(500));
    expect(long).toHaveLength(160);
    expect(long.endsWith('…')).toBe(true);
  });

  it('appends to $GITHUB_STEP_SUMMARY without overwriting earlier steps', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grove-sync-summary-'));
    const file = join(dir, 'step-summary.md');
    await writeFile(file, '## Earlier step\n\n', 'utf8');

    expect(await appendSyncStepSummary(mixed, file)).toBe(true);
    expect(await appendSyncStepSummary(clean, file)).toBe(true);

    const contents = await readFile(file, 'utf8');
    expect(contents.startsWith('## Earlier step\n\n### grove sync github\n')).toBe(true);
    expect(contents).toBe(
      `## Earlier step\n\n${formatSyncSummaryMarkdown(mixed)}\n${formatSyncSummaryMarkdown(clean)}\n`,
    );
  });

  it('skips the step summary when the variable is unset', async () => {
    expect(await appendSyncStepSummary(mixed, undefined)).toBe(false);
    expect(await appendSyncStepSummary(mixed, '')).toBe(false);
  });

  it('exits non-zero under --strict only when a record failed', () => {
    expect(syncExitCode(mixed, true)).toBe(1);
    expect(syncExitCode(mixed, false)).toBe(0);
    expect(syncExitCode(clean, true)).toBe(0);
    // An HTML fallback is still a successful refresh.
    expect(syncExitCode([{ slug: 'bun', outcome: 'html', reason: 'API: 500' }], true)).toBe(0);
    expect(syncExitCode([], true)).toBe(0);
  });
});
