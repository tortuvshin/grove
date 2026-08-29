import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type AuditResult,
  type BudgetViolation,
  DEFAULT_BUDGET,
  evaluateBudget,
  type LighthouseMetrics,
  type LighthouseScores,
  type PageManifestEntry,
  type PageType,
  type Profile,
} from '@grove-dev/core';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse, { type Result as LHResult } from 'lighthouse';
import * as ts from 'typescript';

const ALLOWED_TYPES = new Set<PageType>([
  'home',
  'directory',
  'collection',
  'record',
  'content',
  'empty',
  '404',
]);

export interface AuditCliOptions {
  baseUrl?: string;
  mobile?: boolean;
  desktop?: boolean;
  runs: number;
  page: string[];
  json?: string;
  junit?: string;
}

export async function runAudit(opts: AuditCliOptions): Promise<number> {
  const manifest = await loadManifest(process.cwd());
  const baseUrl = opts.baseUrl ?? manifest.baseUrl;
  const profiles = profilesFromOptions(opts);
  const runs = clampRuns(opts.runs);
  const pageFilter = opts.page.length > 0 ? new Set(opts.page) : null;
  const pages = manifest.pages.filter((p) => !pageFilter || pageFilter.has(p.path));

  // A `--page` value that matches nothing used to leave `pages` empty,
  // which skipped every loop below and still printed a passing
  // scorecard with an exit code of 0 — a typo in CI read as a green
  // audit. Fail loudly instead, and name the paths that do exist.
  if (pages.length === 0) {
    const known = manifest.pages.map((p) => p.path).join(', ');
    console.error(
      `[audit] no pages matched ${[...(pageFilter ?? [])].join(', ')}. ` +
        `audit.pages[] declares: ${known}`,
    );
    return 1;
  }

  const results: AuditResult[] = [];
  const chrome = await chromeLauncher.launch({
    chromeFlags: buildChromeFlags(process.platform, true),
    ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
  });
  try {
    for (const profile of profiles) {
      for (const page of pages) {
        const url = joinUrl(baseUrl, page.path);
        const runsFor: Array<Omit<AuditResult, 'runs'>> = [];
        for (let i = 0; i < runs; i++) {
          const start = Date.now();
          const result = await lighthouse(url, {
            port: chrome.port,
            output: 'json',
            logLevel: 'error',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            formFactor: profile,
            screenEmulation:
              profile === 'mobile'
                ? {
                    mobile: true,
                    width: 412,
                    height: 823,
                    deviceScaleFactor: 1.75,
                    disabled: false,
                  }
                : {
                    mobile: false,
                    width: 1350,
                    height: 940,
                    deviceScaleFactor: 1,
                    disabled: false,
                  },
            throttling:
              profile === 'mobile'
                ? {
                    rttMs: 150,
                    throughputKbps: 1638.4,
                    requestLatencyMs: 562.5,
                    downloadThroughputKbps: 1474.56,
                    uploadThroughputKbps: 675,
                    cpuSlowdownMultiplier: 4,
                  }
                : {
                    rttMs: 40,
                    throughputKbps: 10240,
                    cpuSlowdownMultiplier: 1,
                    requestLatencyMs: 0,
                    downloadThroughputKbps: 0,
                    uploadThroughputKbps: 0,
                  },
          });
          if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
          const lhr = result.lhr;
          runsFor.push({
            url,
            type: page.type,
            profile,
            scores: extractScores(lhr),
            metrics: extractMetrics(lhr),
            durationMs: Date.now() - start,
          });
        }
        results.push(aggregateRuns(url, page.type, profile, runsFor));
        process.stdout.write(`✓ ${profile} ${page.path}\n`);
      }
    }
  } finally {
    await chrome.kill();
  }

  const violations: BudgetViolation[] = [];
  for (const r of results) {
    const page = pages.find((p) => joinUrl(baseUrl, p.path) === r.url);
    if (page) violations.push(...evaluateBudget(r, page, DEFAULT_BUDGET));
  }

  if (opts.json) await writeJsonReport(opts.json, results, violations);
  if (opts.junit) await writeJunitReport(opts.junit, results, violations);

  if (violations.length > 0) {
    process.stderr.write(`\n✗ ${violations.length} budget violation(s)\n`);
    for (const v of violations) {
      process.stderr.write(
        `  [${v.profile}] ${v.page.path} ${v.category}.${v.name}: expected ${v.expected}, got ${v.actual}\n`,
      );
    }
    return 1;
  }
  // The scorecard message used to claim "100×4" (perfect on every
  // category). The default budget now targets Google's "good"
  // thresholds (0.9 / lcp 2500 / cls 0.25 / tbt 200), so the literal
  // claim no longer matches reality. Describe the actual budget in
  // the message so consumers and the unit test regex don't drift from
  // the code that enforces it.
  process.stdout.write(
    `\n✓ ${results.length} page/profile combinations passed the budget ` +
      `(scores ≥ 0.9, lcp ≤ 2500ms, cls ≤ 0.25, tbt ≤ 200ms)\n`,
  );
  return 0;
}

export async function loadManifest(
  cwd: string,
): Promise<{ baseUrl: string; pages: PageManifestEntry[] }> {
  const configPath = resolve(cwd, 'grove.config.ts');
  const source = await readFile(configPath, 'utf8');
  const ast = ts.createSourceFile(
    'grove.config.ts',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  function extractAuditFromConfigLiteral(
    node: ts.ObjectLiteralExpression,
  ): { baseUrl?: string; pages: PageManifestEntry[] } | undefined {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) && propName(prop.name) === 'audit') {
        if (ts.isObjectLiteralExpression(prop.initializer)) {
          return parseAuditBlock(prop.initializer);
        }
      }
    }
    return undefined;
  }

  let audit: { baseUrl?: string; pages: PageManifestEntry[] } | undefined;
  for (const stmt of ast.statements) {
    // Handle bare `defineConfig({...})`.
    if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
      const arg = stmt.expression.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        audit = extractAuditFromConfigLiteral(arg);
      }
    }
    // Handle `export default defineConfig({...})`.
    if (ts.isExportAssignment(stmt) && ts.isCallExpression(stmt.expression)) {
      const arg = stmt.expression.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        audit = extractAuditFromConfigLiteral(arg);
      }
    }
  }
  if (!audit?.pages?.length) throw new Error('grove.config.ts must declare audit.pages[]');
  for (const page of audit.pages) {
    if (!ALLOWED_TYPES.has(page.type))
      throw new Error(`Invalid page type "${page.type}" for ${page.path}`);
  }
  return { baseUrl: audit.baseUrl ?? 'http://127.0.0.1:4321', pages: audit.pages };
}

export function parseAuditBlock(node: ts.ObjectLiteralExpression): {
  baseUrl?: string;
  pages: PageManifestEntry[];
} {
  const out: { baseUrl?: string; pages: PageManifestEntry[] } = { pages: [] };
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propName(prop.name);
    if (name === 'baseUrl' && ts.isStringLiteral(prop.initializer))
      out.baseUrl = prop.initializer.text;
    if (name === 'pages' && ts.isArrayLiteralExpression(prop.initializer)) {
      out.pages = prop.initializer.elements
        .filter(ts.isObjectLiteralExpression)
        .map((el) => parsePageEntry(el));
    }
  }
  return out;
}

export function parsePageEntry(node: ts.ObjectLiteralExpression): PageManifestEntry {
  const entry: PageManifestEntry = { path: '', type: 'home' as PageType, label: '' };
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = propName(prop.name);
    if (name === 'path' && ts.isStringLiteral(prop.initializer)) entry.path = prop.initializer.text;
    if (name === 'type' && ts.isStringLiteral(prop.initializer))
      entry.type = prop.initializer.text as PageType;
    if (name === 'label' && ts.isStringLiteral(prop.initializer))
      entry.label = prop.initializer.text;
  }
  return entry;
}

export function propName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
}

function profilesFromOptions(opts: AuditCliOptions): Profile[] {
  if (opts.mobile && !opts.desktop) return ['mobile'];
  if (opts.desktop && !opts.mobile) return ['desktop'];
  return ['mobile', 'desktop'];
}

function clampRuns(input: number): number {
  return Math.min(Math.max(input, 1), 5);
}

function buildChromeFlags(platform: NodeJS.Platform, headless: boolean): string[] {
  const flags: string[] = [];
  if (headless) flags.push('--headless=new', '--disable-gpu', '--disable-dev-shm-usage');
  if (platform === 'linux') flags.push('--no-sandbox');
  return flags;
}

function joinUrl(base: string, path: string): string {
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

export function extractScores(lhr: LHResult): LighthouseScores {
  const c = lhr.categories ?? {};
  return {
    performance: c.performance?.score ?? 0,
    accessibility: c.accessibility?.score ?? 0,
    bestPractices: c['best-practices']?.score ?? 0,
    seo: c.seo?.score ?? 0,
  };
}

export function extractMetrics(lhr: LHResult): LighthouseMetrics {
  const a = lhr.audits ?? {};
  return {
    lcp: a['largest-contentful-paint']?.numericValue ?? Infinity,
    cls: a['cumulative-layout-shift']?.numericValue ?? Infinity,
    tbt: a['total-blocking-time']?.numericValue ?? Infinity,
  };
}

export function aggregateRuns(
  url: string,
  type: PageType,
  profile: Profile,
  runs: Array<Omit<AuditResult, 'runs'>>,
): AuditResult {
  if (runs.length === 0) throw new Error('aggregateRuns requires at least one run');
  const med = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  };
  return {
    url,
    type,
    profile,
    scores: {
      performance: med(runs.map((r) => r.scores.performance)),
      accessibility: med(runs.map((r) => r.scores.accessibility)),
      bestPractices: med(runs.map((r) => r.scores.bestPractices)),
      seo: med(runs.map((r) => r.scores.seo)),
    },
    metrics: {
      lcp: med(runs.map((r) => r.metrics.lcp)),
      cls: med(runs.map((r) => r.metrics.cls)),
      tbt: med(runs.map((r) => r.metrics.tbt)),
    },
    runs: runs.length,
    durationMs: Math.max(...runs.map((r) => r.durationMs)),
  };
}

async function writeJsonReport(
  path: string,
  results: AuditResult[],
  violations: BudgetViolation[],
): Promise<void> {
  await writeFile(path, JSON.stringify({ results, violations }, null, 2), 'utf8');
}

async function writeJunitReport(
  path: string,
  results: AuditResult[],
  violations: BudgetViolation[],
): Promise<void> {
  const failures = new Map<string, BudgetViolation[]>();
  for (const v of violations) {
    const key = `${v.profile}:${v.page.path}`;
    const list = failures.get(key) ?? [];
    list.push(v);
    failures.set(key, list);
  }
  const cases = results
    .map((r) => {
      const key = `${r.profile}:${new URL(r.url).pathname}`;
      const failed = failures.get(key);
      const failure =
        failed && failed.length > 0
          ? `<failure type="${failed[0]!.category}" message="${esc(failed.map((f) => `${f.name}: expected ${f.expected}, got ${f.actual}`).join('; '))}"/>`
          : '';
      return `<testcase name="${esc(r.profile)} ${esc(new URL(r.url).pathname)}" classname="grove.audit">${failure}</testcase>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="grove-audit" tests="${results.length}" failures="${violations.length}">
${cases}
</testsuite>`;
  await writeFile(path, xml, 'utf8');
}

function esc(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  );
}
