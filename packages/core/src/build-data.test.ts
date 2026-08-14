/**
 * @grove-dev/core — build-data.ts unit tests.
 *
 * The brief calls out `applyDecision` as a load-bearing function:
 *   - When a project record has no existing health block but a
 *     decisions.yml override exists, the function fabricates an
 *     "unknown" health block (via `classifyHealth(slug)`) and
 *     writes the decision's visibility into it. This is the
 *     preserved (vs. removed) decision from the audit, and the
 *     test pins the chosen behavior.
 *   - For resource-hub / ecosystem-map records (no `health`
 *     block), the decision visibility goes onto the record's
 *     top-level `visibility` field.
 *
 * `generate` itself is tested via filesystem round-trip with a
 * real tmpdir.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "./build-data.js";
import { toIndexRecord } from "./schema.js";
import type { Resource } from "./schema.js";

function makeProject(overrides: Partial<Resource> = {}): Resource {
  return {
    kind: "project",
    slug: "demo",
    name: "Demo",
    description: "A demo",
    category: "tools",
    tags: [],
    links: {},
    curation: { reviewed: false, labels: [], lenses: [] },
    scores: {},
    visibility: "keep",
    ...overrides,
  } as Resource;
}

describe("toIndexRecord — fabrication behaviour (applyDecision shape)", () => {
  it("a project record with no health block + a decision.decision.visibility of 'hide' fabricates a health block carrying that visibility", async () => {
    // This test pins the PRESERVED audit decision: when a
    // project record has no health block but a decisions.yml
    // override exists, applyDecision (called inside generate)
    // fabricates a health block via classifyHealth(slug) (the
    // canonical unknown shape) and overwrites visibility.
    // The fabrication must keep the unknown status / maturity /
    // tier, and only visibility changes.
    //
    // We exercise the public `toIndexRecord` path, which is what
    // generate ultimately calls, with a record that has been
    // through the applyDecision path (simulate that here by
    // hand).
    const project = makeProject();
    // The "fabricated" record is what applyDecision produces:
    const fabricated = {
      ...project,
      health: {
        status: "unknown" as const,
        maturity: "unknown" as const,
        tier: "experimental" as const,
        visibility: "hide" as const,
        cleanupCandidate: false,
        staleReason: null,
        confidence: "low" as const,
        reasons: ["No GitHub metadata available"],
      },
    };
    const idx = toIndexRecord(fabricated);
    // The index record's `visibility` (read by the index
    // filter) must reflect the decision override, not the
    // fabricated default of "keep".
    expect((idx as { visibility?: string }).visibility).toBe("hide");
  });
});

describe("generate — filesystem round-trip", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "grove-build-test-"));
    await mkdir(join(cwd, "data", "records"), { recursive: true });
    await mkdir(join(cwd, "data", "generated"), { recursive: true });
    // grove.config.ts stub so loadConfig() doesn't throw.
    await writeFile(
      join(cwd, "grove.config.ts"),
      [
        "export default {",
        "  site: { name: 'test', tagline: 'test' },",
        "  paths: { recordsDir: 'data/records', generatedDir: 'data/generated', health: 'data/health.yml', decisions: 'data/decisions.yml' },",
        "  blueprint: 'project-directory',",
        "  nav: [],",
        "  analytics: { googleAnalyticsId: 'G-TEST123' },",
        "  facets: ['stack', 'tags'],",
        "  footer: { columns: [{ heading: 'Explore', items: [{ label: 'Browse', href: '/projects' }] }], license: 'CC BY 4.0' },",
        "  submission: { title: 'Suggest a project', good: ['Public source'], avoid: ['Duplicates'] },",
        "  theme: {},",
        "  integrations: {},",
        "};",
      ].join("\n"),
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("generates records.full.json, records.index.json, and records.json (alias) from a real records dir", async () => {
    await writeFile(
      join(cwd, "data", "records", "demo.yml"),
      [
        "kind: project",
        "slug: demo",
        "name: Demo",
        "description: a demo",
        "category: tools",
        "links: {}",
        "curation: { reviewed: false, labels: [], lenses: [] }",
        "scores: {}",
      ].join("\n"),
    );

    const r = await generate(cwd);
    expect(r.totalRecords).toBe(1);
    expect(r.visibleRecords).toBe(1);
    // The three files were all written.
    const full = JSON.parse(await readFile(r.fullPath, "utf8")) as { totalRecords: number };
    const idx = JSON.parse(await readFile(r.indexPath, "utf8")) as { totalRecords: number };
    const alias = JSON.parse(await readFile(r.aliasPath, "utf8")) as { totalRecords: number };
    expect(full.totalRecords).toBe(1);
    expect(idx.totalRecords).toBe(1);
    // Alias == full payload.
    expect(alias).toEqual(full);
  });

  it("applies a decisions.yml override of visibility='hide' to a project record without a health block", async () => {
    // The brief's load-bearing test: a project record that has
    // no health block, plus a decisions.yml that says
    // "hide" for that slug, must produce a hidden record in the
    // full payload AND exclude it from the index payload.
    await writeFile(
      join(cwd, "data", "records", "hidden.yml"),
      [
        "kind: project",
        "slug: hidden",
        "name: Hidden",
        "description: should be hidden by decisions.yml",
        "category: tools",
        "links: {}",
        "curation: { reviewed: false, labels: [], lenses: [] }",
        "scores: {}",
      ].join("\n"),
    );
    await writeFile(
      join(cwd, "data", "decisions.yml"),
      [
        "decisions:",
        "  - id: hidden",
        "    decision:",
        "      visibility: hide",
        "      reason: tested override",
      ].join("\n"),
    );

    const r = await generate(cwd);
    expect(r.totalRecords).toBe(1); // full payload still includes the record
    expect(r.visibleRecords).toBe(0); // but the index payload omits it

    const full = JSON.parse(await readFile(r.fullPath, "utf8")) as {
      records: Array<{ slug: string; health?: { visibility?: string } }>;
    };
    const hidden = full.records.find((rec) => rec.slug === "hidden");
    expect(hidden).toBeDefined();
    // The fabrication: a health block exists, and its visibility
    // is "hide" (the decision override), not "keep" (the
    // fabricated default).
    expect(hidden?.health?.visibility).toBe("hide");
  });

  it("writes site-config.json with stats derived from the records", async () => {
    await writeFile(
      join(cwd, "data", "records", "coolify.yml"),
      [
        "kind: project",
        "slug: coolify",
        "name: Coolify",
        "description: self-hosting",
        "category: tools",
        "stacks: [typescript]",
        "links: {}",
        "curation: { reviewed: false, labels: [], lenses: [] }",
        "scores: {}",
      ].join("\n"),
    );
    const r = await generate(cwd);
    const sitePath = join(cwd, "data", "generated", "site-config.json");
    const site = JSON.parse(await readFile(sitePath, "utf8")) as {
      stats: { totalRecords: number; totalApps: number };
      facets: string[];
      footer: { columns: Array<{ heading: string }>; license: string };
      submission: { title: string; good: string[]; avoid: string[] };
      analytics: { googleAnalyticsId: string };
      contributors: { showContributionCount: boolean };
    };
    expect(site.stats.totalRecords).toBe(1);
    expect(site.stats.totalApps).toBe(1);
    expect(site.facets).toEqual(["stack", "tags"]);
    expect(site.footer.columns[0]?.heading).toBe("Explore");
    expect(site.footer.license).toBe("CC BY 4.0");
    expect(site.submission).toEqual({
      title: "Suggest a project",
      good: ["Public source"],
      avoid: ["Duplicates"],
    });
    expect(site.analytics.googleAnalyticsId).toBe("G-TEST123");
    // The contributors preference must reach site-config.json so the
    // Astro layer can honor `showContributionCount`.
    expect(site.contributors).toEqual({ showContributionCount: true });
  });

  it("keeps site repository metadata separate from directory aggregates", async () => {
    await writeFile(
      join(cwd, "data", "generated", "repo-stats.json"),
      JSON.stringify({
        repoUrl: "https://github.com/acme/community",
        stars: 42,
        forks: 7,
        contributors: 3,
      }),
    );

    await generate(cwd);
    const site = JSON.parse(
      await readFile(join(cwd, "data", "generated", "site-config.json"), "utf8"),
    ) as {
      stats: Record<string, number | string>;
    };

    expect(site.stats.repositoryStars).toBe(42);
    expect(site.stats.repositoryForks).toBe(7);
    expect(site.stats.repositoryContributors).toBe(3);
    expect(site.stats.originalRepo).toBe("");
  });

  it("writes configured taxonomy names to site-config.json", async () => {
    await mkdir(join(cwd, "data", "taxonomy"), { recursive: true });
    await writeFile(
      join(cwd, "data", "taxonomy", "categories.yml"),
      [
        "- id: news",
        "  name: News and Magazine",
        "- id: tools",
        "  name: Developer Tools",
      ].join("\n"),
    );
    await writeFile(
      join(cwd, "data", "records", "reader.yml"),
      [
        "kind: project",
        "slug: reader",
        "name: Reader",
        "description: news reader",
        "category: news",
        "links: {}",
        "curation: { reviewed: false, labels: [], lenses: [] }",
        "scores: {}",
      ].join("\n"),
    );

    await generate(cwd);
    const site = JSON.parse(
      await readFile(join(cwd, "data", "generated", "site-config.json"), "utf8"),
    ) as {
      taxonomy?: { categories?: Array<{ id: string; name: string }> };
    };

    expect(site.taxonomy?.categories).toEqual([
      { id: "news", name: "News and Magazine" },
      { id: "tools", name: "Developer Tools" },
    ]);
  });
});
