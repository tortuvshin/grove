/**
 * The one table of push-age cutoffs every Grove health classifier
 * reads, so "stale" means the same thing in `classifyHealth`,
 * `classifyRepositoryHealth` and the docs.
 *
 * The signal is GitHub's `pushed_at`: the last time anything was
 * pushed to any branch. It is not commit activity, and old pushes do
 * not make a project dead — so the reasons say "push", and every band
 * past `active` means "a person should look", not a verdict.
 */

export const DAY_MS = 86_400_000;

export type PushAgeBandId = 'active' | 'stale' | 'needs_review' | 'inactive';

export interface PushAgeBand {
  id: PushAgeBandId;
  /** Inclusive upper bound in days since the last push. */
  maxDays: number;
  /** Stable machine-readable reason, `null` for the active band. */
  staleReason: string | null;
  /** Plain-language reason matching `staleReason`. */
  reason: string;
}

/**
 * Up to 6 months → active, 6–18 months → stale, 18–24 months →
 * needs_review, over 24 months → inactive. Month edges are in days
 * (183 / 548 / 730) and inclusive: a repo last pushed exactly 183 days
 * ago is still active.
 */
export const PUSH_AGE_BANDS: readonly PushAgeBand[] = [
  {
    id: 'active',
    maxDays: 183,
    staleReason: null,
    reason: 'Pushed to within the last 6 months',
  },
  {
    id: 'stale',
    maxDays: 548,
    staleReason: 'no_push_6_months',
    reason: 'No push in the last 6 months',
  },
  {
    id: 'needs_review',
    maxDays: 730,
    staleReason: 'no_push_18_months',
    reason: 'No push in the last 18 months',
  },
  {
    id: 'inactive',
    maxDays: Number.POSITIVE_INFINITY,
    staleReason: 'no_push_24_months',
    reason: 'No push in the last 24 months',
  },
];

/** Cutoffs by band id, for callers that compare one edge directly. */
export const PUSH_AGE_MAX_DAYS: Readonly<Record<PushAgeBandId, number>> = Object.fromEntries(
  PUSH_AGE_BANDS.map((band) => [band.id, band.maxDays]),
) as Record<PushAgeBandId, number>;

/** A release within this many days counts as a recent release. */
export const RECENT_RELEASE_WITHIN_DAYS = 365;

/** Star count from which a repository counts as popular. */
export const POPULAR_STARS = 500;

/** Days between `value` and `now`; `Infinity` for a missing or unparseable date. */
export function daysSince(value: string | null | undefined, now: number = Date.now()): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (now - time) / DAY_MS;
}

/** The band a push `days` ago falls in. A missing push date is `inactive`. */
export function pushAgeBand(days: number): PushAgeBand {
  for (const band of PUSH_AGE_BANDS) {
    if (days <= band.maxDays) return band;
  }
  // Unreachable: the last band's bound is Infinity. NaN lands here.
  return PUSH_AGE_BANDS[PUSH_AGE_BANDS.length - 1] as PushAgeBand;
}
