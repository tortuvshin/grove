/**
 * Record → `CollectionEntry` projection.
 *
 * One mapper for every caller that runs a collection — the page view
 * model in `@grove-dev/astro`, and `prepareDirectory`, which counts a
 * collection's entries for its OG caption. Two mappers meant two
 * answers to "how many records are in this collection".
 *
 * The projection reads the data a synced record actually carries.
 * `health.status` is the lifecycle value `excludeStatuses` filters on
 * (`archived`, `stale`, …); the record's own `visibility` is a curation
 * decision and only ever says `keep`. Ranking inputs come from an
 * explicit `scores` block when a curator wrote one, and otherwise from
 * the GitHub sync: recent releases, pushes and commits for activity,
 * stars on a log scale for adoption. Without that fallback every preset
 * scores 0 and a "ranked" collection renders in file order.
 */
import type { CollectionEntry } from './collections.js';
import { getOwnerAndRepoFromRepoUrl, getOwnerAvatarUrl } from './directory-repo.js';

export interface CollectionSourceRecord {
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  stack?: string;
  stacks?: string[];
  platforms?: string[];
  license?: string;
  licenses?: string[];
  visibility?: string;
  repoUrl?: string;
  logoUrl?: string;
  links?: { github?: string; website?: string };
  stars?: number;
  forks?: number;
  pushedAt?: string | null;
  lastCommitAt?: string | null;
  scores?: { curation?: number; activity?: number };
  relations?: Array<{ type: string; to: string }>;
  health?: { status?: string; visibility?: string };
  github?: {
    stars?: number;
    license?: string;
    pushedAt?: string | null;
    latestReleaseAt?: string | null;
    repository?: {
      stargazers_count?: number;
      forks_count?: number;
      pushed_at?: string | null;
      license?: { spdx_id?: string | null } | null;
    };
    activity?: { monthlyCommits?: Array<{ month: string; commits: number }> };
  };
}

export interface ToCollectionEntriesOptions {
  /** Directory route slug; an entry's `url` is `/<routeSlug>/<slug>/`. */
  routeSlug: string;
  /** Clock for the freshness signals. Defaults to `Date.now()`. */
  now?: number;
}

const DAY = 24 * 3600 * 1000;
const HIDDEN = new Set(['hide', 'remove']);

function freshness(date: string | null | undefined, windowDays: number, now: number): number {
  const time = date ? Date.parse(date) : Number.NaN;
  if (!Number.isFinite(time)) return 0;
  return Math.min(1, Math.max(0, 1 - (now - time) / (windowDays * DAY)));
}

/**
 * Mean of: release freshness (180-day window), push freshness (90-day
 * window) and, when commit history is synced, the share of the recorded
 * commits made in the last three months.
 */
function activityFromGithub(
  github: NonNullable<CollectionSourceRecord['github']>,
  pushedAt: string | undefined,
  now: number,
): number {
  const signals = [freshness(github.latestReleaseAt, 180, now), freshness(pushedAt, 90, now)];
  const months = github.activity?.monthlyCommits;
  if (months?.length) {
    const total = months.reduce((sum, month) => sum + month.commits, 0);
    const recent = months.slice(-3).reduce((sum, month) => sum + month.commits, 0);
    if (total > 0) signals.push(recent / total);
  }
  return signals.reduce((sum, value) => sum + value, 0) / signals.length;
}

/** Stars on a log scale: 10 → 0.2, 1k → 0.6, 100k → 1. */
function adoptionFromStars(stars: number): number {
  return Math.min(1, Math.log10(stars + 1) / 5);
}

export function toCollectionEntries(
  records: CollectionSourceRecord[],
  options: ToCollectionEntriesOptions,
): CollectionEntry[] {
  const now = options.now ?? Date.now();
  const out: CollectionEntry[] = [];
  for (const r of records) {
    if (!r.slug) continue;
    if (HIDDEN.has(r.visibility ?? '') || HIDDEN.has(r.health?.visibility ?? '')) continue;

    const categories = [...new Set([...(r.category ? [r.category] : []), ...(r.tags ?? [])])];
    const stack = r.stack ?? r.stacks?.[0];
    const license = r.license ?? r.github?.license ?? r.github?.repository?.license?.spdx_id;
    const licenses = r.licenses?.length ? r.licenses : license ? [license] : undefined;
    const status = r.health?.status ?? r.visibility;
    const stars = r.stars ?? r.github?.stars ?? r.github?.repository?.stargazers_count;
    const forks = r.forks ?? r.github?.repository?.forks_count;
    const pushedAt =
      r.pushedAt ?? r.lastCommitAt ?? r.github?.pushedAt ?? r.github?.repository?.pushed_at;
    const repoHref = r.repoUrl ?? r.links?.github;
    const activityScore =
      r.scores?.activity ??
      (r.github ? activityFromGithub(r.github, pushedAt ?? undefined, now) : undefined);
    const curationScore =
      r.scores?.curation ?? (stars !== undefined ? adoptionFromStars(stars) : undefined);

    const avatarUrl =
      r.logoUrl ??
      getOwnerAvatarUrl(getOwnerAndRepoFromRepoUrl(repoHref ?? '').owner, 80) ??
      undefined;

    out.push({
      slug: r.slug,
      title: r.name ?? r.title ?? r.slug,
      description: r.description ?? '',
      url: `/${options.routeSlug}/${r.slug}/`,
      ...(repoHref ? { repoHref } : {}),
      ...(r.links?.website ? { homepageHref: r.links.website } : {}),
      ...(stack ? { stack } : {}),
      ...(r.platforms ? { platform: r.platforms } : {}),
      ...(license ? { license } : {}),
      ...(licenses ? { licenses } : {}),
      ...(status ? { status } : {}),
      ...(stars !== undefined ? { stars } : {}),
      ...(forks !== undefined ? { forks } : {}),
      ...(pushedAt ? { pushedAt } : {}),
      ...(curationScore !== undefined ? { curationScore } : {}),
      ...(activityScore !== undefined ? { activityScore } : {}),
      ...(categories.length ? { categories } : {}),
      ...(r.tags?.length ? { tags: r.tags } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(r.relations?.length
        ? { relations: r.relations.map(({ type, to }) => ({ type, to })) }
        : {}),
    });
  }
  return out;
}
