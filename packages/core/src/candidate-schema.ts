import { z } from 'zod';

/**
 * Channel and media candidates: install channels, logos and
 * screenshots that `grove sync github` finds for a record when
 * `integrations.github.candidates` is on.
 *
 * Candidates live in the GitHub sync cache, never in the record, and
 * nothing renders them. A reviewer approves or rejects each one in
 * `paths.decisions` (see {@link candidateReviewSchema}); copying an
 * approved one into the record stays a human edit.
 */

/** Where a candidate was found. */
export const candidateOriginSchema = z.enum([
  'fdroid',
  'flathub',
  'repology',
  'github-releases',
  'fastlane',
  'appstream',
  'web-manifest',
  'repo-asset',
]);

export type CandidateOrigin = z.infer<typeof candidateOriginSchema>;

export const candidateKindSchema = z.enum(['channel', 'logo', 'screenshot']);
export type CandidateKind = z.infer<typeof candidateKindSchema>;

/**
 * Where the evidence for a candidate came from: the source, the URL
 * that proved it (a commit-pinned permalink for files in the
 * repository, the API endpoint for a package index), and when.
 */
export const candidateProvenanceSchema = z.object({
  source: candidateOriginSchema,
  url: z.string().min(1),
  fetchedAt: z.string().min(1),
});

export type CandidateProvenance = z.infer<typeof candidateProvenanceSchema>;

/** An install channel, shaped like a `distribution.channels[]` entry plus evidence. */
export const channelCandidateSchema = z.object({
  /** Channel id: `fdroid`, `flathub`, `github-releases`, `snapcraft` or `package-manager`. */
  type: z.string().min(1),
  platform: z.string().optional(),
  label: z.string().min(1),
  url: z.string().min(1),
  /** What the source reported: app id, release tag and assets, package names. */
  facts: z.record(z.string(), z.unknown()).default({}),
  provenance: candidateProvenanceSchema,
});

export type ChannelCandidate = z.infer<typeof channelCandidateSchema>;

/** A logo or screenshot. Facts are cheap ones: never a full download. */
export const mediaCandidateSchema = z.object({
  /** Commit-pinned permalink for a repository file, else the URL as found. */
  url: z.string().min(1),
  /** Path in the repository, when the file lives there. */
  path: z.string().optional(),
  /** Git blob SHA of that file: an unchanged blob keeps its candidate. */
  blobSha: z.string().optional(),
  /** fastlane locale directory, e.g. `en-US`. */
  locale: z.string().optional(),
  format: z.string().optional(),
  /** Size from the git tree. */
  bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  provenance: candidateProvenanceSchema,
});

export type MediaCandidate = z.infer<typeof mediaCandidateSchema>;

export const recordCandidatesSchema = z.object({
  channels: z.array(channelCandidateSchema).default([]),
  logos: z.array(mediaCandidateSchema).default([]),
  screenshots: z.array(mediaCandidateSchema).default([]),
});

export type RecordCandidates = z.infer<typeof recordCandidatesSchema>;

/**
 * A reviewer's verdict on one candidate, listed under `candidates:`
 * in `paths.decisions`. `id` is the record slug; `kind` and `url`
 * name the candidate exactly as `grove candidates` prints it. A media
 * candidate's URL is pinned to a commit, so a changed file shows up
 * as a new candidate and is reviewed again.
 */
export const candidateReviewSchema = z.object({
  id: z.string().min(1),
  kind: candidateKindSchema,
  url: z.string().min(1),
  verdict: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  provenance: candidateProvenanceSchema,
});

export type CandidateReview = z.infer<typeof candidateReviewSchema>;
