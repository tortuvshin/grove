import {
  decisionsFileSchema,
  healthFileSchema,
  itemsFileSchema,
  unwrapDecisions,
  unwrapHealth,
  unwrapItems,
} from "@open-curated/core";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { AppLabel, AppStatus, OpenSourceApp } from "./types";

const items = unwrapItems(itemsFileSchema.parse(parse(readFileSync("data/items.yml", "utf8"))));
const health = unwrapHealth(healthFileSchema.parse(parse(readFileSync("data/health.yml", "utf8"))));
const decisions = unwrapDecisions(decisionsFileSchema.parse(parse(readFileSync("data/decisions.yml", "utf8"))));

const healthById = new Map(health.map((entry) => [entry.id, entry]));
const decisionById = new Map(decisions.map((entry) => [entry.id, entry]));

function statusFor(value: string | undefined): AppStatus {
  if (value === "active" || value === "stale" || value === "archived" || value === "unknown") return value;
  if (value === "inactive" || value === "needs_review") return "stale";
  if (value === "mature") return "active";
  return "unknown";
}

function labelsFor(item: (typeof items)[number], stars = 0, status?: string): AppLabel[] {
  const explicit = (item.labels ?? []).filter((label): label is AppLabel =>
    label === "new" || label === "hot" || label === "mature" || label === "featured",
  );
  if (explicit.length > 0) return explicit;
  const labels: AppLabel[] = [];
  if (stars >= 500 || status === "mature") labels.push("mature");
  if (status === "active" || (stars >= 100 && stars < 500)) labels.push("hot");
  if (labels.length === 0) labels.push("new");
  return labels;
}

function repoParts(url?: string) {
  const match = url?.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

function normalize(): OpenSourceApp[] {
  return items.map((item) => {
    const h = healthById.get(item.id);
    const github = h?.github;
    const decision = decisionById.get(item.id);
    const repo = repoParts(item.links.github);
    const labels = labelsFor(item, github?.stars, h?.health.status);
    const curation = item.curation ?? {
      bestFor: [],
      whyListed: [],
      caveats: [],
      scores: {},
    };
    const projectType = curation.projectType === "library" || curation.projectType === "tool"
      ? "reference"
      : curation.projectType === "historical"
        ? "reference"
        : curation.projectType;

    return {
      slug: item.id,
      name: item.name,
      description: item.description,
      repoUrl: item.links.github ?? item.links.website ?? "#",
      homepageUrl: item.links.website,
      stack: item.taxonomy.language ?? github?.language ?? "Unknown",
      stacks: [...new Set([...(item.taxonomy.tags ?? []), ...(github?.topics ?? [])])].slice(0, 6),
      platforms: item.distribution?.channels?.map((channel) => channel.platform).filter((value): value is string => Boolean(value)) ?? ["web"],
      distribution: item.distribution,
      category: item.taxonomy.category,
      tags: item.taxonomy.tags,
      stars: github?.stars,
      license: github?.license ?? undefined,
      status: statusFor(h?.health.status),
      addedAt: item.source.type === "markdown" ? undefined : "2026-06-08",
      lastCommitAt: github?.pushedAt ?? undefined,
      labels,
      projectType: projectType === "production" || projectType === "reference" || projectType === "demo" || projectType === "template"
        ? projectType
        : undefined,
      difficulty: curation.difficulty,
      codebaseSize: curation.codebaseSize,
      bestFor: curation.bestFor,
      whyListed: curation.whyListed.length > 0
        ? curation.whyListed
        : decision ? [decision.decision.reason] : undefined,
      caveats: curation.caveats,
      goodFirstIssues: curation.goodFirstIssues,
      contributionGuide: curation.contributionGuide,
      lenses: item.lenses ?? [],
      scores: curation.scores && Object.values(curation.scores).some((v) => typeof v === "number")
        ? {
            activity: curation.scores.activity ?? 0,
            maturity: curation.scores.maturity ?? 0,
            learning: curation.scores.learning ?? 0,
            contribution: curation.scores.contribution ?? 0,
            docs: curation.scores.docs ?? 0,
            overall: curation.scores.overall ?? 0,
          }
        : undefined,
      curation: curation.reviewed === undefined ? undefined : {
        reviewed: curation.reviewed,
        by: curation.reviewedBy,
        date: curation.reviewedAt,
        notes: curation.notes,
      },
      github: github ? {
        repository: {
          full_name: github.fullName,
          html_url: item.links.github,
          homepage: item.links.website,
          archived: github.archived,
          disabled: github.disabled,
          default_branch: github.defaultBranch,
          language: github.language,
          topics: github.topics,
          license: github.license ? { spdx_id: github.license, name: github.license } : null,
          stargazers_count: github.stars,
          watchers_count: github.stars,
          forks_count: github.forks,
          open_issues_count: github.openIssues,
          updated_at: github.updatedAt,
          pushed_at: github.pushedAt,
        },
        languages: github.languages,
        latestRelease: github.latestReleaseAt ? {
          published_at: github.latestReleaseAt,
          html_url: item.links.github ? `${item.links.github}/releases` : undefined,
        } : null,
        activity: {
          monthlyCommits: github.monthlyCommits,
          totalCommitsKnown: github.totalCommitsKnown,
          contributorsKnown: github.contributorsKnown,
          openPullRequests: github.openPullRequests,
        },
        files: github.files,
      } : undefined,
      health: h ? {
        status: h.health.status,
        tier: h.health.maturity,
        visibility: decision?.decision.visibility === "hide" || decision?.decision.visibility === "remove" ? "hidden" : "listed",
        cleanupCandidate: ["stale", "inactive", "archived", "needs_review"].includes(h.health.status),
        staleReason: h.health.reasons[0] ?? null,
      } : undefined,
      tier: h?.health.maturity,
    };
  });
}

export const apps: OpenSourceApp[] = normalize();

export function newApps(): OpenSourceApp[] {
  return apps.filter((app) => app.labels?.includes("new"));
}

export function hotApps(): OpenSourceApp[] {
  return apps.filter((app) => app.labels?.includes("hot"));
}

export function matureApps(): OpenSourceApp[] {
  return apps.filter((app) => app.labels?.includes("mature"));
}

export function appBySlug(slug: string): OpenSourceApp | undefined {
  return apps.find((app) => app.slug === slug);
}
