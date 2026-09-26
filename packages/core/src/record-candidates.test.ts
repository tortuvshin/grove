import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChannelCandidate, MediaCandidate, RecordCandidates } from './candidate-schema.js';
import { defineConfig } from './config.js';
import {
  candidateRows,
  listRecordCandidates,
  mergeRecordCandidates,
  normalizeCandidateUrl,
} from './record-candidates.js';
import { decisionsFileSchema, unwrapCandidateReviews, unwrapDecisions } from './schema.js';

const OLD = '2026-09-01T00:00:00.000Z';
const NEW = '2026-09-26T00:00:00.000Z';

function channel(overrides: Partial<ChannelCandidate> = {}, fetchedAt = NEW): ChannelCandidate {
  return {
    type: 'fdroid',
    platform: 'android',
    label: 'F-Droid',
    url: 'https://f-droid.org/packages/org.example/',
    facts: { appId: 'org.example' },
    provenance: {
      source: 'fdroid',
      url: 'https://f-droid.org/api/v1/packages/org.example',
      fetchedAt,
    },
    ...overrides,
  };
}

function logo(commit: string, blobSha: string, fetchedAt = NEW): MediaCandidate {
  const url = `https://github.com/o/r/blob/${commit}/fastlane/metadata/android/en-US/images/icon.png`;
  return {
    url,
    path: 'fastlane/metadata/android/en-US/images/icon.png',
    blobSha,
    format: 'png',
    bytes: 100,
    width: 512,
    height: 512,
    provenance: { source: 'fastlane', url, fetchedAt },
  };
}

const empty: RecordCandidates = { channels: [], logos: [], screenshots: [] };

describe('mergeRecordCandidates', () => {
  it('keeps an unchanged candidate, fetchedAt included, so re-runs write the same bytes', () => {
    const previous = { ...empty, channels: [channel({}, OLD)] };
    const merged = mergeRecordCandidates(previous, { ...empty, channels: [channel()] });
    expect(merged.channels[0]?.provenance.fetchedAt).toBe(OLD);
  });

  it('replaces a candidate whose facts changed', () => {
    const previous = { ...empty, channels: [channel({}, OLD)] };
    const next = {
      ...empty,
      channels: [channel({ facts: { appId: 'org.example', suggestedVersionCode: 2 } })],
    };
    expect(mergeRecordCandidates(previous, next).channels[0]?.provenance.fetchedAt).toBe(NEW);
  });

  it('keeps a repository file pinned to its old commit while the blob is unchanged', () => {
    const previous = { ...empty, logos: [logo('aaa', 'blob1', OLD)] };
    const same = mergeRecordCandidates(previous, { ...empty, logos: [logo('bbb', 'blob1')] });
    expect(same.logos[0]?.url).toContain('/blob/aaa/');
    const changed = mergeRecordCandidates(previous, { ...empty, logos: [logo('bbb', 'blob2')] });
    expect(changed.logos[0]?.url).toContain('/blob/bbb/');
  });

  it('keeps previous candidates of a source that failed this run, and drops the rest', () => {
    const previous = {
      ...empty,
      channels: [
        channel({}, OLD),
        channel(
          {
            type: 'package-manager',
            label: 'Homebrew',
            url: 'https://formulae.brew.sh/cask/x',
            provenance: {
              source: 'repology',
              url: 'https://repology.org/project/x/versions',
              fetchedAt: OLD,
            },
          },
          OLD,
        ),
      ],
    };
    expect(
      mergeRecordCandidates(previous, empty, new Set(['repology'])).channels.map((c) => c.label),
    ).toEqual(['Homebrew']);
    expect(mergeRecordCandidates(previous, empty).channels).toEqual([]);
  });

  it('sorts deterministically and writes keys in schema order', () => {
    const a = channel({
      type: 'github-releases',
      platform: 'windows',
      label: 'GitHub Releases',
      url: 'https://github.com/o/r/releases/latest',
    });
    const b = channel();
    const shuffled = { ...logo('c', 's'), height: 1, width: 2 } as MediaCandidate;
    const merged = mergeRecordCandidates(undefined, {
      channels: [a, b],
      logos: [shuffled],
      screenshots: [],
    });
    expect(merged.channels.map((c) => c.type)).toEqual(['fdroid', 'github-releases']);
    expect(Object.keys(merged.logos[0] ?? {})).toEqual([
      'url',
      'path',
      'blobSha',
      'format',
      'bytes',
      'width',
      'height',
      'provenance',
    ]);
    expect(
      JSON.stringify(
        mergeRecordCandidates(undefined, { channels: [b, a], logos: [], screenshots: [] }),
      ),
    ).toBe(
      JSON.stringify(
        mergeRecordCandidates(undefined, { channels: [a, b], logos: [], screenshots: [] }),
      ),
    );
  });
});

describe('decisions file', () => {
  it('accepts candidates next to decisions and keeps the list form working', () => {
    const file = decisionsFileSchema.parse({
      candidates: [
        {
          id: 'demo',
          kind: 'channel',
          url: 'https://f-droid.org/packages/org.example/',
          verdict: 'approved',
          reviewedBy: 'someone',
          provenance: channel().provenance,
        },
      ],
    });
    expect(unwrapDecisions(file)).toEqual([]);
    expect(unwrapCandidateReviews(file)).toHaveLength(1);
    expect(unwrapCandidateReviews(decisionsFileSchema.parse([]))).toEqual([]);
  });

  it('requires provenance on a verdict', () => {
    expect(
      decisionsFileSchema.safeParse({
        candidates: [
          { id: 'demo', kind: 'logo', url: 'https://x.test/a.png', verdict: 'approved' },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('candidateRows', () => {
  const candidates: RecordCandidates = {
    channels: [
      channel(),
      channel({
        type: 'flathub',
        platform: 'linux',
        label: 'Flathub',
        url: 'https://flathub.org/apps/org.example',
      }),
      channel({
        type: 'github-releases',
        label: 'GitHub Releases',
        url: 'https://github.com/o/r/releases/latest',
      }),
    ],
    logos: [logo('aaa', 'blob1')],
    screenshots: [],
  };

  it('resolves approved, rejected, in-record and pending', () => {
    const reviews = [
      {
        id: 'demo',
        kind: 'channel' as const,
        url: 'https://F-Droid.org/packages/org.example',
        verdict: 'approved' as const,
        provenance: channel().provenance,
      },
      {
        id: 'demo',
        kind: 'logo' as const,
        url: logo('aaa', 'blob1').url,
        verdict: 'rejected' as const,
        provenance: logo('aaa', 'blob1').provenance,
      },
      // Another record's verdict does not apply.
      {
        id: 'other',
        kind: 'channel' as const,
        url: 'https://flathub.org/apps/org.example',
        verdict: 'approved' as const,
        provenance: channel().provenance,
      },
    ];
    const record = {
      distribution: {
        channels: [{ type: 'github-releases', url: 'https://github.com/o/r/releases/latest/' }],
      },
    };
    const rows = candidateRows('demo', candidates, reviews, record);
    expect(rows.map((r) => [r.kind, r.status])).toEqual([
      ['channel', 'approved'],
      ['channel', 'pending'],
      ['channel', 'in-record'],
      ['logo', 'rejected'],
    ]);
  });

  it('normalizes URLs for matching', () => {
    expect(normalizeCandidateUrl('https://Example.org/a/#x')).toBe('https://example.org/a');
  });
});

describe('listRecordCandidates', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'grove-candidates-'));
    await mkdir(join(cwd, 'data', 'records'), { recursive: true });
    await mkdir(join(cwd, 'data', 'cache', 'github'), { recursive: true });
    for (const slug of ['alpha', 'beta']) {
      await writeFile(
        join(cwd, 'data', 'records', `${slug}.yml`),
        `kind: project\nslug: ${slug}\nname: ${slug}\n`,
      );
    }
    const entry = (slug: string, candidates?: RecordCandidates) =>
      JSON.stringify({
        schemaVersion: 1,
        slug,
        lastSuccessAt: null,
        partialFailures: [],
        ...(candidates ? { candidates } : {}),
      });
    await writeFile(
      join(cwd, 'data', 'cache', 'github', 'alpha.json'),
      entry('alpha', { ...empty, channels: [channel()] }),
    );
    await writeFile(join(cwd, 'data', 'cache', 'github', 'beta.json'), entry('beta'));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const config = defineConfig({
    site: { name: 't', tagline: 't' },
    blueprint: 'project-directory',
  });

  it('lists pending candidates and hides reviewed ones unless --all', async () => {
    expect((await listRecordCandidates(config, cwd)).rows.map((r) => r.slug)).toEqual(['alpha']);
    await writeFile(
      join(cwd, 'data', 'decisions.yml'),
      [
        'candidates:',
        '  - id: alpha',
        '    kind: channel',
        '    url: https://f-droid.org/packages/org.example/',
        '    verdict: rejected',
        '    reason: wrong app',
        '    provenance:',
        '      source: fdroid',
        '      url: https://f-droid.org/api/v1/packages/org.example',
        "      fetchedAt: '2026-09-26T00:00:00.000Z'",
      ].join('\n'),
    );
    const pending = await listRecordCandidates(config, cwd);
    expect(pending.rows).toEqual([]);
    expect(pending.recordsWithCandidates).toBe(1);
    const all = await listRecordCandidates(config, cwd, { all: true, slug: 'alpha' });
    expect(all.rows.map((r) => r.status)).toEqual(['rejected']);
  });

  it('reports an unreadable decisions file instead of treating it as empty silently', async () => {
    await writeFile(join(cwd, 'data', 'decisions.yml'), 'candidates:\n  - id: alpha\n');
    const listing = await listRecordCandidates(config, cwd);
    expect(listing.decisionsError).toBeDefined();
    expect(listing.rows).toHaveLength(1);
  });
});
