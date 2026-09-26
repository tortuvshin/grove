import type { CandidateListing } from '@grove-dev/core';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { formatCandidatesMarkdown, formatCandidatesText } from './candidates-cli.js';

const provenance = {
  source: 'fastlane' as const,
  url: 'https://github.com/o/r/blob/abc/fastlane/metadata/android/en-US/images/icon.png',
  fetchedAt: '2026-09-26T00:00:00.000Z',
};

const listing: CandidateListing = {
  recordsWithCandidates: 2,
  rows: [
    {
      slug: 'demo',
      kind: 'logo',
      status: 'pending',
      candidate: {
        url: provenance.url,
        path: 'fastlane/metadata/android/en-US/images/icon.png',
        format: 'png',
        bytes: 36_038,
        width: 512,
        height: 512,
        provenance,
      },
    },
    {
      slug: 'demo',
      kind: 'channel',
      status: 'pending',
      candidate: {
        type: 'package-manager',
        platform: 'macos',
        label: 'Homebrew Cask',
        url: 'https://formulae.brew.sh/cask/demo',
        facts: { package: 'demo', match: 'project-name', versionMatchesRelease: false },
        provenance: {
          source: 'repology',
          url: 'https://repology.org/project/demo/versions',
          fetchedAt: provenance.fetchedAt,
        },
      },
    },
  ],
};

describe('grove candidates output', () => {
  it('prints one block per record with a summary', () => {
    const out = formatCandidatesText(listing);
    expect(out).toContain('demo\n  logo       png · 512×512 · 35 KB');
    expect(out).toContain('Homebrew Cask · macos · package demo · name match only');
    expect(out).toContain(
      '2 pending candidate(s) across 1 record(s); 2 record(s) have candidates in the sync cache.',
    );
  });

  it('prints Markdown tables and decision entries that parse as a decisions file', () => {
    const md = formatCandidatesMarkdown(listing);
    expect(md).toContain('| logo | [fastlane/metadata/android/en-US/images/icon.png](');
    expect(md).toContain('[repology](https://repology.org/project/demo/versions)');
    const yaml = /```yaml\n([\s\S]*?)```/.exec(md)?.[1] ?? '';
    const parsed = parseYaml(yaml) as { candidates: Array<Record<string, unknown>> };
    expect(parsed.candidates.map((c) => [c.id, c.kind, c.url, c.verdict])).toEqual([
      ['demo', 'logo', provenance.url, 'approved'],
      ['demo', 'channel', 'https://formulae.brew.sh/cask/demo', 'approved'],
    ]);
    expect(parsed.candidates[0]?.provenance).toEqual(provenance);
  });
});
