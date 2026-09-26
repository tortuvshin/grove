import type { RepositoryEvidence } from './evidence.js';
import {
  daysSince,
  POPULAR_STARS,
  PUSH_AGE_MAX_DAYS,
  RECENT_RELEASE_WITHIN_DAYS,
} from './health-thresholds.js';

export type RepositoryHealthStatus =
  | 'active'
  | 'maintained'
  | 'stable'
  | 'likely-stale'
  | 'archived'
  | 'broken'
  | 'unknown';

export type RepositoryHealthConfidence = 'high' | 'medium' | 'low';

export interface RepositoryHealthResult {
  status: RepositoryHealthStatus;
  confidence: RepositoryHealthConfidence;
  evidence: string[];
  counterEvidence: string[];
}

function unknown(reason: string): RepositoryHealthResult {
  return { status: 'unknown', confidence: 'low', evidence: [reason], counterEvidence: [] };
}

// The push-age bands come from the shared table in health-thresholds.ts,
// so a README link and a directory record read the same cutoffs. This
// classifier keeps its own vocabulary: the `stale` band (6–18 months)
// reads as `stable` here, and both later bands as `likely-stale` — with
// medium confidence up to 24 months and low confidence beyond.
const ACTIVE_WITHIN_DAYS = PUSH_AGE_MAX_DAYS.active;
const STABLE_WITHIN_DAYS = PUSH_AGE_MAX_DAYS.stale;
const CONFIDENT_STALE_WITHIN_DAYS = PUSH_AGE_MAX_DAYS.needs_review;

export function classifyRepositoryHealth(evidence: RepositoryEvidence): RepositoryHealthResult {
  if (evidence.status === 'not-found') {
    return {
      status: 'broken',
      confidence: 'high',
      evidence: ['Repository not found on GitHub (404)'],
      counterEvidence: [],
    };
  }
  if (evidence.status === 'invalid-url') {
    return unknown('Link is not a recognizable GitHub repository URL');
  }
  if (evidence.status === 'rate-limited') {
    return unknown('GitHub lookup was rate-limited before evidence could be gathered');
  }
  if (evidence.status === 'error') {
    return unknown(`Lookup failed: ${evidence.error ?? 'unknown error'}`);
  }

  const github = evidence.github;
  if (!github) {
    return unknown('No repository metadata available');
  }

  if (github.archived) {
    return {
      status: 'archived',
      confidence: 'high',
      evidence: ['Repository is archived on GitHub'],
      counterEvidence: [],
    };
  }

  if (evidence.source === 'html') {
    return unknown(
      'Only partial evidence available (GitHub API was rate-limited; activity signals unknown)',
    );
  }

  const pushedDays = daysSince(github.pushedAt);
  const releaseDays = daysSince(github.latestReleaseAt);
  const hasRecentRelease = releaseDays <= RECENT_RELEASE_WITHIN_DAYS;
  const popular = github.stars >= POPULAR_STARS;
  const months = (days: number) => Math.round(days / 30);

  if (pushedDays <= ACTIVE_WITHIN_DAYS) {
    const evidenceLines = [`Pushed to within the last ${Math.round(pushedDays)} days`];
    if (hasRecentRelease || popular) {
      evidenceLines.push(
        hasRecentRelease ? 'Recent release found' : 'Strong community adoption (star count)',
      );
      return {
        status: 'maintained',
        confidence: 'high',
        evidence: evidenceLines,
        counterEvidence: [],
      };
    }
    return { status: 'active', confidence: 'high', evidence: evidenceLines, counterEvidence: [] };
  }

  if (pushedDays <= STABLE_WITHIN_DAYS) {
    const counterEvidence: string[] = [];
    if (hasRecentRelease) counterEvidence.push('A release was published within the last year');
    return {
      status: 'stable',
      confidence: 'high',
      evidence: [`No push in ${Math.round(pushedDays)} days (~${months(pushedDays)} months)`],
      counterEvidence,
    };
  }

  const counterEvidence: string[] = [];
  if (hasRecentRelease) counterEvidence.push('A release was published within the last year');
  return {
    status: 'likely-stale',
    confidence: pushedDays <= CONFIDENT_STALE_WITHIN_DAYS ? 'medium' : 'low',
    evidence: [`No push in ${Math.round(pushedDays)} days (~${months(pushedDays)} months)`],
    counterEvidence,
  };
}
