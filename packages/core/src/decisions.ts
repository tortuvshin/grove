import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { type AppRecord, normalizeAppRecord, parseAppYaml } from "./schema.js";
import { type CuratedConfig, loadConfig } from "./config.js";

export interface ReviewCandidate {
  slug: string;
  name: string;
  repoUrl: string;
  status: string;
  tier: string;
  staleReason: string | null;
  lastCommitAt: string | null;
  stars: number;
}

export interface ReviewReport {
  generatedAt: string;
  totalCandidates: number;
  candidates: ReviewCandidate[];
}

function toCandidate(app: AppRecord): ReviewCandidate {
  return {
    slug: app.slug,
    name: app.name,
    repoUrl: app.repoUrl,
    status: app.status,
    tier: app.tier,
    staleReason: app.staleReason,
    lastCommitAt: app.lastCommitAt ?? null,
    stars: app.stars ?? 0,
  };
}

/** Compute the set of review candidates from normalized app records. */
export function pickReviewCandidates(apps: AppRecord[]): AppRecord[] {
  return apps.filter(
    (app) =>
      app.cleanupCandidate ||
      app.status === "unknown" ||
      app.status === "needs_review",
  );
}

/**
 * Read every apps/*.yml, normalize, then write data/generated/review-report.json
 * with cleanup candidates (unknown / needs_review / cleanupCandidate).
 */
export async function buildReviewReport(
  cwd = process.cwd(),
  config?: CuratedConfig,
): Promise<{ report: ReviewReport; path: string }> {
  const cfg = config ?? (await loadConfig(cwd));
  const appsDir = resolve(cwd, cfg.paths.appsDir);
  const outDir = resolve(cwd, cfg.paths.generatedDir);
  await mkdir(outDir, { recursive: true });

  let entries: string[] = [];
  try {
    entries = await readdir(appsDir);
  } catch {
    entries = [];
  }
  const files = entries.filter((f) => f.endsWith(".yml")).sort();
  const apps: AppRecord[] = [];
  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    const text = await readFile(join(appsDir, file), "utf8");
    const raw = parseAppYaml(text, fileSlug);
    apps.push(normalizeAppRecord(raw, fileSlug));
  }
  const candidates = pickReviewCandidates(apps).map(toCandidate);
  const report: ReviewReport = {
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    candidates,
  };
  const path = join(outDir, "review-report.json");
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
  return { report, path };
}
