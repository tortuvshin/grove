import type { GithubMetadata, HealthEntry, HealthStatus, HealthTier } from "./schema.js";

function daysSince(value: string | null | undefined): number {
  if (!value) return Infinity;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return Infinity;
  return (Date.now() - date.valueOf()) / 86_400_000;
}

export function classifyHealth(id: string, github?: GithubMetadata): HealthEntry {
  if (!github) {
    return {
      id,
      health: {
        status: "unknown",
        maturity: "unknown",
        tier: "experimental",
        visibility: "keep",
        cleanupCandidate: false,
        staleReason: null,
        confidence: "low",
        reasons: ["No GitHub metadata available"],
      },
    };
  }

  const reasons: string[] = [];
  const pushedDays = daysSince(github.pushedAt);
  const releaseDays = daysSince(github.latestReleaseAt);

  let status: HealthStatus = "unknown";
  if (github.archived) {
    status = "archived";
    reasons.push("Repository is archived on GitHub");
  } else if (pushedDays <= 183) {
    status = "active";
    reasons.push("Recent repository activity");
  } else if (pushedDays <= 548) {
    status = "stale";
    reasons.push("No recent commits in the last 6 months");
  } else if (pushedDays > 730) {
    status = "inactive";
    reasons.push("No commits in the last 24 months");
  } else {
    status = "needs_review";
    reasons.push("Repository activity is old enough to need review");
  }

  const hasRelease = releaseDays <= 365;
  const hasLicense = Boolean(github.license && github.license !== "NOASSERTION");
  const popular = github.stars >= 500;
  const maintainedSignals = pushedDays <= 183 && (hasRelease || hasLicense);

  let maturity: HealthEntry["health"]["maturity"] = "unknown";
  if (status === "archived" || status === "inactive") {
    maturity = "unknown";
  } else if (popular && maintainedSignals) {
    maturity = "mature";
    if (status === "active") status = "mature";
    reasons.push("Strong adoption with maintenance signals");
  } else if (github.stars >= 50 || maintainedSignals) {
    maturity = "useful";
  } else {
    maturity = "experimental";
  }

  if (hasRelease) reasons.push("Recent release found");
  if (hasLicense) reasons.push("Clear license found");
  if (!hasLicense) reasons.push("License is missing or unclear");

  const tier: HealthTier =
    status === "archived" || status === "inactive"
      ? "hidden"
      : popular
        ? "curated"
        : github.stars >= 50
          ? "listed"
          : "experimental";

  return {
    id,
    github,
    health: {
      status,
      maturity,
      tier,
      visibility: tier === "hidden" ? "hide" : "keep",
      cleanupCandidate: status === "stale" || status === "archived" || status === "inactive",
      staleReason:
        status === "inactive"
          ? "no_commits_24_months"
          : status === "stale"
            ? "no_commits_365_days"
            : status === "archived"
              ? "github_archived"
              : null,
      confidence: github.fullName ? "high" : "medium",
      reasons,
    },
  };
}
