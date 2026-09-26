import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  CandidateKind,
  CandidateOrigin,
  CandidateReview,
  ChannelCandidate,
  MediaCandidate,
  RecordCandidates,
} from './candidate-schema.js';
import { loadGithubCache } from './github-cache.js';
import { readRecordSources } from './normalize-records.js';
import { decisionsFileSchema, type GroveConfig, unwrapCandidateReviews } from './schema.js';

// ── Ordering and carry-over ────────────────────────────────────────

/** Logo sources, most trustworthy first: what the app ships to a store beats a file that looks like a logo. */
const MEDIA_SOURCE_RANK: Record<CandidateOrigin, number> = {
  fastlane: 0,
  appstream: 1,
  'web-manifest': 2,
  'repo-asset': 3,
  fdroid: 4,
  flathub: 5,
  repology: 6,
  'github-releases': 7,
};

function compareText(a: string | undefined, b: string | undefined): number {
  const x = a ?? '';
  const y = b ?? '';
  return x < y ? -1 : x > y ? 1 : 0;
}

function compareNatural(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', 'en', { numeric: true });
}

function compareChannels(a: ChannelCandidate, b: ChannelCandidate): number {
  return (
    compareText(a.type, b.type) ||
    compareText(a.platform, b.platform) ||
    compareText(a.label, b.label) ||
    compareText(a.url, b.url)
  );
}

function compareMedia(a: MediaCandidate, b: MediaCandidate): number {
  return (
    MEDIA_SOURCE_RANK[a.provenance.source] - MEDIA_SOURCE_RANK[b.provenance.source] ||
    compareText(a.locale, b.locale) ||
    compareNatural(a.path ?? a.url, b.path ?? b.url) ||
    compareText(a.url, b.url)
  );
}

function orderedChannel(c: ChannelCandidate): ChannelCandidate {
  return {
    type: c.type,
    ...(c.platform !== undefined ? { platform: c.platform } : {}),
    label: c.label,
    url: c.url,
    facts: c.facts,
    provenance: {
      source: c.provenance.source,
      url: c.provenance.url,
      fetchedAt: c.provenance.fetchedAt,
    },
  };
}

function orderedMedia(c: MediaCandidate): MediaCandidate {
  return {
    url: c.url,
    ...(c.path !== undefined ? { path: c.path } : {}),
    ...(c.blobSha !== undefined ? { blobSha: c.blobSha } : {}),
    ...(c.locale !== undefined ? { locale: c.locale } : {}),
    ...(c.format !== undefined ? { format: c.format } : {}),
    ...(c.bytes !== undefined ? { bytes: c.bytes } : {}),
    ...(c.width !== undefined ? { width: c.width } : {}),
    ...(c.height !== undefined ? { height: c.height } : {}),
    provenance: {
      source: c.provenance.source,
      url: c.provenance.url,
      fetchedAt: c.provenance.fetchedAt,
    },
  };
}

/**
 * Sort candidates into their canonical, deterministic order, with
 * every object's keys in schema order, so the cache file's bytes only
 * depend on what was found.
 */
export function sortRecordCandidates(candidates: RecordCandidates): RecordCandidates {
  return {
    channels: candidates.channels.map(orderedChannel).sort(compareChannels),
    logos: candidates.logos.map(orderedMedia).sort(compareMedia),
    screenshots: candidates.screenshots.map(orderedMedia).sort(compareMedia),
  };
}

function withoutFetchedAt<T extends { provenance: { fetchedAt: string } }>(candidate: T): string {
  return JSON.stringify({ ...candidate, provenance: { ...candidate.provenance, fetchedAt: '' } });
}

function channelKey(c: ChannelCandidate): string {
  return `${c.type}\u0000${c.platform ?? ''}\u0000${c.url}`;
}

function mediaKey(c: MediaCandidate): string {
  // A repository file is the same candidate while its blob is
  // unchanged, even though every new commit gives it a new permalink.
  return c.path && c.blobSha ? `${c.path}\u0000${c.blobSha}` : c.url;
}

function mediaFacts(c: MediaCandidate): string {
  const { url: _url, provenance, ...rest } = c;
  return JSON.stringify({ ...rest, source: provenance.source });
}

function carryOver<T extends { provenance: { source: CandidateOrigin; fetchedAt: string } }>(
  previous: readonly T[],
  next: readonly T[],
  key: (c: T) => string,
  same: (a: T, b: T) => boolean,
  failedSources: ReadonlySet<CandidateOrigin>,
): T[] {
  const before = new Map(previous.map((c) => [key(c), c]));
  const out: T[] = next.map((candidate) => {
    const old = before.get(key(candidate));
    return old && same(old, candidate) ? old : candidate;
  });
  // A source that failed this time keeps what it found last time, the
  // way a failed metadata fetch keeps the last known `github` block.
  const seen = new Set(out.map(key));
  for (const candidate of previous) {
    if (failedSources.has(candidate.provenance.source) && !seen.has(key(candidate))) {
      out.push(candidate);
      seen.add(key(candidate));
    }
  }
  return out;
}

/**
 * Fold freshly collected candidates into the previous ones.
 *
 * - An unchanged candidate keeps its previous object, `fetchedAt`
 *   included, so re-running sync on unchanged data writes the same
 *   bytes. A repository file counts as unchanged while its blob SHA is.
 * - Candidates from a source in `failedSources` are kept from the
 *   previous run instead of disappearing.
 * - The result is sorted into canonical order.
 */
export function mergeRecordCandidates(
  previous: RecordCandidates | undefined,
  next: RecordCandidates,
  failedSources: ReadonlySet<CandidateOrigin> = new Set(),
): RecordCandidates {
  const prev = previous ?? { channels: [], logos: [], screenshots: [] };
  const sameChannel = (a: ChannelCandidate, b: ChannelCandidate) =>
    withoutFetchedAt(a) === withoutFetchedAt(b);
  const sameMedia = (a: MediaCandidate, b: MediaCandidate) =>
    a.path && a.blobSha
      ? mediaFacts(a) === mediaFacts(b)
      : withoutFetchedAt(a) === withoutFetchedAt(b);
  return sortRecordCandidates({
    channels: carryOver(prev.channels, next.channels, channelKey, sameChannel, failedSources),
    logos: carryOver(prev.logos, next.logos, mediaKey, sameMedia, failedSources),
    screenshots: carryOver(prev.screenshots, next.screenshots, mediaKey, sameMedia, failedSources),
  });
}

// ── Review status ──────────────────────────────────────────────────

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'in-record';

export interface CandidateRow {
  slug: string;
  kind: CandidateKind;
  status: CandidateStatus;
  candidate: ChannelCandidate | MediaCandidate;
  /** The verdict that decided `approved` / `rejected`. */
  review?: CandidateReview;
}

/** Compare URLs ignoring case in the host and a trailing slash. */
export function normalizeCandidateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** URLs a record already carries, per candidate kind. */
function recordUrls(record: Record<string, unknown>): Record<CandidateKind, Set<string>> {
  const urls: Record<CandidateKind, Set<string>> = {
    channel: new Set(),
    logo: new Set(),
    screenshot: new Set(),
  };
  const channels = asObject(record.distribution)?.channels;
  if (Array.isArray(channels)) {
    for (const channel of channels) {
      const url = asObject(channel)?.url;
      if (typeof url === 'string') urls.channel.add(normalizeCandidateUrl(url));
    }
  }
  if (typeof record.logoUrl === 'string') urls.logo.add(normalizeCandidateUrl(record.logoUrl));
  if (Array.isArray(record.screenshots)) {
    for (const shot of record.screenshots) {
      const obj = asObject(shot);
      for (const field of ['src', 'source']) {
        const url = obj?.[field];
        if (typeof url === 'string') urls.screenshot.add(normalizeCandidateUrl(url));
      }
    }
  }
  return urls;
}

/**
 * Every candidate of one record with its review status: `approved` or
 * `rejected` when `paths.decisions` has a verdict for its exact URL,
 * `in-record` when the record already carries that URL, else `pending`.
 */
export function candidateRows(
  slug: string,
  candidates: RecordCandidates | undefined,
  reviews: readonly CandidateReview[],
  record: Record<string, unknown> = {},
): CandidateRow[] {
  if (!candidates) return [];
  const verdicts = new Map<string, CandidateReview>();
  for (const review of reviews) {
    if (review.id !== slug) continue;
    verdicts.set(`${review.kind}\u0000${normalizeCandidateUrl(review.url)}`, review);
  }
  const inRecord = recordUrls(record);
  const rows: CandidateRow[] = [];
  const add = (kind: CandidateKind, list: ReadonlyArray<ChannelCandidate | MediaCandidate>) => {
    for (const candidate of list) {
      const url = normalizeCandidateUrl(candidate.url);
      const review = verdicts.get(`${kind}\u0000${url}`);
      const status: CandidateStatus = review
        ? review.verdict
        : inRecord[kind].has(url)
          ? 'in-record'
          : 'pending';
      rows.push({ slug, kind, status, candidate, ...(review ? { review } : {}) });
    }
  };
  add('channel', candidates.channels);
  add('logo', candidates.logos);
  add('screenshot', candidates.screenshots);
  return rows;
}

export interface ListCandidatesOptions {
  /** Only this record. */
  slug?: string;
  /** Include approved, rejected and in-record candidates, not just pending ones. */
  all?: boolean;
}

export interface CandidateListing {
  rows: CandidateRow[];
  /** Records whose cache entry has a `candidates` block. */
  recordsWithCandidates: number;
  /** Set when `paths.decisions` exists but could not be parsed. */
  decisionsError?: string;
}

/** Candidate verdicts in `paths.decisions`; a missing file has none. */
export async function loadCandidateReviews(
  config: GroveConfig,
  cwd = process.cwd(),
): Promise<{ reviews: CandidateReview[]; error?: string }> {
  let text: string;
  try {
    text = await readFile(resolve(cwd, config.paths.decisions), 'utf8');
  } catch {
    return { reviews: [] };
  }
  try {
    const raw = parseYaml(text, { schema: 'core' }) ?? { decisions: [] };
    return { reviews: unwrapCandidateReviews(decisionsFileSchema.parse(raw)) };
  } catch (err) {
    return { reviews: [], error: (err as Error).message };
  }
}

/**
 * Candidates from the GitHub sync cache with their review status, in
 * record order. Read-only: approving stays a human edit to
 * `paths.decisions` or the record.
 */
export async function listRecordCandidates(
  config: GroveConfig,
  cwd = process.cwd(),
  options: ListCandidatesOptions = {},
): Promise<CandidateListing> {
  const [{ sources }, cache, { reviews, error }] = await Promise.all([
    readRecordSources(config, cwd),
    loadGithubCache(config, cwd),
    loadCandidateReviews(config, cwd),
  ]);
  const records = new Map(sources.map((source) => [source.slug, source.data ?? {}]));
  const rows: CandidateRow[] = [];
  let recordsWithCandidates = 0;
  const slugs = [...cache.entries.keys()].sort();
  for (const slug of slugs) {
    if (options.slug && slug !== options.slug) continue;
    const entry = cache.entries.get(slug);
    if (!entry?.candidates) continue;
    recordsWithCandidates += 1;
    for (const row of candidateRows(slug, entry.candidates, reviews, records.get(slug))) {
      if (options.all || row.status === 'pending') rows.push(row);
    }
  }
  return { rows, recordsWithCandidates, ...(error ? { decisionsError: error } : {}) };
}
