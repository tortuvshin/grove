import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from './config.js';
import { blueprintKind, type GroveConfig, type Resource, recordsFileSchema } from './schema.js';

export interface CleanupCandidate {
  slug: string;
  name: string;
  url: string;
  status: string;
  tier: string;
  staleReason: string | null;
  lastCommitAt: string | null;
  stars: number;
}

export interface CleanupReport {
  generatedAt: string;
  blueprint: string;
  totalCandidates: number;
  candidates: CleanupCandidate[];
}

function toCandidate(record: Resource): CleanupCandidate {
  const name = record.kind === 'resource' ? record.title : record.name;
  const url = record.links?.github ?? record.links?.website ?? record.links?.source ?? '';
  const health = (
    record as { health?: { status?: string; tier?: string; staleReason?: string | null } }
  ).health;
  const gh = (
    record as { github?: { repository?: { pushed_at?: string; stargazers_count?: number } } }
  ).github?.repository;
  return {
    slug: record.slug,
    name,
    url,
    status: health?.status ?? 'unknown',
    tier: health?.tier ?? 'experimental',
    staleReason: health?.staleReason ?? null,
    lastCommitAt: gh?.pushed_at ?? null,
    stars: gh?.stargazers_count ?? 0,
  };
}

/** Filter records down to the ones that need a human curation pass. */
export function pickCleanupCandidates(records: Resource[]): Resource[] {
  return records.filter((r) => {
    const health = (r as { health?: { cleanupCandidate?: boolean; status?: string } }).health;
    if (health?.cleanupCandidate) return true;
    if (health?.status === 'unknown' || health?.status === 'needs_review') return true;
    return false;
  });
}

/**
 * Read every record YAML under `config.paths.recordsDir`, normalize,
 * then write `data/generated/cleanup-report.json` with the list of
 * records that need human attention (stale / unknown / cleanup).
 *
 * V1 name for what was previously `review`.
 */
export async function cleanupStale(
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<{ report: CleanupReport; path: string }> {
  const cfg = config ?? (await loadConfig(cwd));
  const recordsDir = resolve(cwd, cfg.paths.recordsDir);
  const outDir = resolve(cwd, cfg.paths.generatedDir);
  await mkdir(outDir, { recursive: true });

  const expectedKind = blueprintKind[cfg.blueprint];
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith('.yml')).sort();

  const records: Resource[] = [];
  for (const file of files) {
    const fileSlug = basename(file, '.yml');
    const text = await readFile(join(recordsDir, file), 'utf8');
    const raw = (parseYaml(text, { schema: 'core' }) ?? {}) as Record<string, unknown>;
    if (!raw.kind) raw.kind = expectedKind;
    try {
      const normalized = recordsFileSchema.parse(raw);
      normalized.slug = fileSlug;
      records.push(normalized);
    } catch {
      // skip — validation surfaces the error
    }
  }

  const candidates = pickCleanupCandidates(records).map(toCandidate);
  const report: CleanupReport = {
    generatedAt: new Date().toISOString(),
    blueprint: cfg.blueprint,
    totalCandidates: candidates.length,
    candidates,
  };
  const path = join(outDir, 'cleanup-report.json');
  await writeFile(path, JSON.stringify(report, null, 2), 'utf8');
  return { report, path };
}
