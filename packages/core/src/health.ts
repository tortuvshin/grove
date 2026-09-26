import {
  daysSince,
  POPULAR_STARS,
  PUSH_AGE_MAX_DAYS,
  pushAgeBand,
  RECENT_RELEASE_WITHIN_DAYS,
} from './health-thresholds.js';
import type { GithubMetadata, HealthEntry, HealthStatus, HealthTier } from './schema.js';

export function classifyHealth(id: string, github?: GithubMetadata): HealthEntry {
  if (!github) {
    return {
      id,
      health: {
        status: 'unknown',
        maturity: 'unknown',
        tier: 'experimental',
        visibility: 'keep',
        cleanupCandidate: false,
        staleReason: null,
        confidence: 'low',
        reasons: ['No GitHub metadata available'],
      },
    };
  }

  const reasons: string[] = [];
  const pushedDays = daysSince(github.pushedAt);
  const releaseDays = daysSince(github.latestReleaseAt);

  // Archived is a fact GitHub reports; every other status is a push-age
  // band from the shared table, and its reason names that band.
  let status: HealthStatus;
  let staleReason: string | null;
  if (github.archived) {
    status = 'archived';
    staleReason = 'github_archived';
    reasons.push('Repository is archived on GitHub');
  } else {
    const band = pushAgeBand(pushedDays);
    status = band.id;
    staleReason = band.staleReason;
    reasons.push(band.reason);
  }

  const hasRelease = releaseDays <= RECENT_RELEASE_WITHIN_DAYS;
  const hasLicense = Boolean(github.license && github.license !== 'NOASSERTION');
  const popular = github.stars >= POPULAR_STARS;
  const maintainedSignals = pushedDays <= PUSH_AGE_MAX_DAYS.active && (hasRelease || hasLicense);

  let maturity: HealthEntry['health']['maturity'] = 'unknown';
  if (status === 'archived' || status === 'inactive') {
    maturity = 'unknown';
  } else if (popular && maintainedSignals) {
    maturity = 'mature';
    if (status === 'active') status = 'mature';
    reasons.push('Strong adoption with maintenance signals');
  } else if (github.stars >= 50 || maintainedSignals) {
    maturity = 'useful';
  } else {
    maturity = 'experimental';
  }

  if (hasRelease) reasons.push('Recent release found');
  if (hasLicense) reasons.push('Clear license found');
  if (!hasLicense) reasons.push('License is missing or unclear');

  const tier: HealthTier =
    status === 'archived' || status === 'inactive'
      ? 'hidden'
      : popular
        ? 'curated'
        : github.stars >= 50
          ? 'listed'
          : 'experimental';

  return {
    id,
    github,
    health: {
      status,
      maturity,
      tier,
      visibility: tier === 'hidden' ? 'hide' : 'keep',
      cleanupCandidate:
        status === 'stale' ||
        status === 'needs_review' ||
        status === 'archived' ||
        status === 'inactive',
      staleReason,
      confidence: github.fullName ? 'high' : 'medium',
      reasons,
    },
  };
}
