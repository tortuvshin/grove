/**
 * @grove-dev/core — `validateProject` unit tests.
 *
 * The brief calls out two silent try/catch blocks in validate.ts:
 *   - line 70:   `readdir(recordsDir).catch(() => [])` — missing
 *                 records dir is silently treated as zero records.
 *                 Tests pin this behaviour so a future "throw on
 *                 missing dir" change is visible.
 *   - line 54-69: the Zod parse step at line 109 is wrapped in a
 *                 try/catch that produces structured `zod_error`
 *                 issues. Tests cover BOTH the valid-input path
 *                 (no issues) and the malformed-input path
 *                 (one or more issues with the right codes).
 *
 * Tests use `tmpdir()` (per the brief — no fs mocks) and chdir
 * into the test dir for the duration of each test (validateProject
 * resolves paths against `process.cwd()`).
 */
import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateProject } from "./validate.js";
import type { GroveConfig } from "./schema.js";

function makeConfig(overrides: Partial<GroveConfig> = {}): GroveConfig {
  return {
    site: { name: "test", tagline: "test" },
    paths: {
      recordsDir: "data/records",
      generatedDir: "data/generated",
      health: "data/health.yml",
      decisions: "data/decisions.yml",
    },
    blueprint: "project-directory",
    nav: [],
    theme: {},
    integrations: {},
    ...overrides,
  } as GroveConfig;
}

/**
 * Run `fn` with `process.cwd()` set to a fresh tmpdir. Restores
 * the original CWD in a finally block so test failures (or thrown
 * asserts) cannot leave the runner in a deleted directory.
 *
 * `mkdtemp` is the right helper here: `os.tmpdir({prefix})` (the
 * Node 22 form) does NOT create a subdir, it just returns the
 * env TMPDIR. `mkdtemp(prefix + '-')` creates a unique directory
 * under the env TMPDIR.
 */
async function withTmpCwd<T>(prefix: string, fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), prefix + "-"));
  const original = process.cwd();
  process.chdir(cwd);
  try {
    return await fn(cwd);
  } finally {
    process.chdir(original);
    await rm(cwd, { recursive: true, force: true });
  }
}

describe("validateProject — happy path", () => {
  it("returns ok=true with no issues when the records dir is empty", async () => {
    await withTmpCwd("grove-validate-empty-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  it("warns when a record uses a category missing from configured taxonomy", async () => {
    await withTmpCwd("grove-validate-taxonomy-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await mkdir(join(cwd, "data", "taxonomy"), { recursive: true });
      await writeFile(
        join(cwd, "data", "taxonomy", "categories.yml"),
        "- id: news\n  name: News and Magazine\n",
      );
      await writeFile(
        join(cwd, "data", "records", "reader.yml"),
        [
          "kind: project",
          "slug: reader",
          "name: Reader",
          "description: a reader",
          "category: news-and-magazine",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.warnings).toContainEqual({
        code: "unknown_taxonomy_value",
        message:
          'reader: category "news-and-magazine" is not defined in data/taxonomy/categories.yml',
        severity: "warning",
      });
    });
  });

  it("allows open-ended supporting technologies outside the primary stack taxonomy", async () => {
    await withTmpCwd("grove-validate-supporting-stacks-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await mkdir(join(cwd, "data", "taxonomy"), { recursive: true });
      await writeFile(
        join(cwd, "data", "taxonomy", "stacks.yml"),
        "- id: ios\n  name: Native iOS\n",
      );
      await writeFile(
        join(cwd, "data", "records", "reader.yml"),
        [
          "kind: project",
          "slug: reader",
          "name: Reader",
          "description: a reader",
          "stack: ios",
          "stacks: [swiftui, spritekit]",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.warnings).toEqual([]);
    });
  });

  it("validates a single well-formed record and returns ok=true", async () => {
    await withTmpCwd("grove-validate-ok-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  it("emits a slug_mismatch warning when filename and record.slug differ", async () => {
    await withTmpCwd("grove-validate-mismatch-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      // Filename is "demo", record.slug is "different-slug". This
      // is a warning, not an error — the record is still considered
      // valid; the warning helps curators notice the mismatch.
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        [
          "kind: project",
          "slug: different-slug",
          "name: Demo",
          "description: a demo",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true); // warnings do not fail by default
      expect(result.warnings.some((w) => w.code === "slug_mismatch")).toBe(true);
    });
  });
});

describe("validateProject — editorial tier gates", () => {
  // A tier is a public claim about how much human work stands behind a
  // record. These are errors rather than warnings so a record cannot
  // ship claiming "reviewed" while carrying nothing but imported
  // metadata.
  const REVIEWED_OK = [
          "kind: project",
          "slug: demo",
          "name: Demo",
          "description: a demo",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
    "bestFor: [developers evaluating self-hosted photo backup]",
    "caveats: [requires Postgres and Redis to self-host]",
    "editorial:",
    "  tier: reviewed",
    "  reviewedAt: '2020-01-01'",
    "  reviewedBy: '@curator'",
    "  verdict: Pick it if you can run containers.",
    "evidence:",
    "  - id: license",
    "    claim: Licensed AGPL-3.0",
    "    url: https://github.com/o/r/blob/abc123/LICENSE",
    "    sourceType: repository-file",
    "    checkedAt: '2020-01-01'",
    "    checkedBy: '@curator'",
  ];

  it("accepts a reviewed record that carries the required editorial data", async () => {
    await withTmpCwd("grove-tier-ok-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        REVIEWED_OK.join("\n"),
      );
      const result = await validateProject(makeConfig());
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    });
  });

  it("defaults to the candidate tier, which requires nothing", async () => {
    await withTmpCwd("grove-tier-default-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it("rejects a reviewed tier with no evidence, verdict, bestFor, or caveats", async () => {
    await withTmpCwd("grove-tier-bare-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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
          "editorial: { tier: reviewed }",
        ].join("\n"),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      const messages = result.errors
        .filter((e) => e.code === "tier_requirements_unmet")
        .map((e) => e.message)
        .join(" | ");
      expect(messages).toContain("reviewedAt");
      expect(messages).toContain("reviewedBy");
      expect(messages).toContain("verdict");
      expect(messages).toContain("bestFor");
      expect(messages).toContain("caveat");
      expect(messages).toContain("evidence");
    });
  });

  it("requires screenshots and alternatives for the featured tier only", async () => {
    await withTmpCwd("grove-tier-featured-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        REVIEWED_OK.map((line) =>
          line === "    \"  tier: reviewed\"," ? line : line,
        )
          .join("\n")
          .replace("tier: reviewed", "tier: featured"),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      const messages = result.errors
        .filter((e) => e.code === "tier_requirements_unmet")
        .map((e) => e.message)
        .join(" | ");
      expect(messages).toContain("screenshot");
      expect(messages).toContain("alternative");
    });
  });

  it("rejects a reviewedAt in the future", async () => {
    await withTmpCwd("grove-tier-future-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString()
        .slice(0, 10);
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        REVIEWED_OK.join("\n").replace("'2020-01-01'", `'${future}'`),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes("is in the future")),
      ).toBe(true);
    });
  });

  it("rejects a nextReviewAt that precedes reviewedAt", async () => {
    await withTmpCwd("grove-tier-order-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        REVIEWED_OK.join("\n").replace(
          "  verdict:",
          "  nextReviewAt: '2019-01-01'\n  verdict:",
        ),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.message.includes("precedes"))).toBe(
        true,
      );
    });
  });

  it("rejects duplicate evidence ids", async () => {
    await withTmpCwd("grove-tier-dupe-evidence-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        [
          ...REVIEWED_OK,
          "  - id: license",
          "    claim: Licensed AGPL-3.0 (duplicate id)",
          "    url: https://github.com/o/r/blob/abc123/COPYING",
          "    sourceType: repository-file",
          "    checkedAt: '2020-01-01'",
          "    checkedBy: '@curator'",
        ].join("\n"),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(
        result.errors.some((e) => e.code === "duplicate_evidence_id"),
      ).toBe(true);
    });
  });

  it("warns when alternatives reference a slug that is not in the directory", async () => {
    await withTmpCwd("grove-tier-alt-ref-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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
          "alternatives:",
          "  - slug: does-not-exist",
          "    name: Ghost",
          "    relationship: open-source-alternative",
          "    note: not in this directory",
        ].join("\n"),
      );
      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true); // a warning, not an error
      expect(
        result.warnings.some((w) => w.code === "unknown_alternative_record"),
      ).toBe(true);
    });
  });
});

describe("validateProject — unknown fields (silent strip)", () => {
  // Record schemas are plain z.object(), so Zod's default *strip*
  // behaviour applies: an undefined field parses cleanly and is then
  // dropped before the build writes data/generated/. Without a
  // diagnostic that data loss is invisible — the record looks accepted
  // and the field simply never appears on the site.
  it("warns for an unknown top-level field instead of accepting it silently", async () => {
    await withTmpCwd("grove-validate-unknown-top-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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
          "verdict: this field does not exist in the schema",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(true); // a warning, not an error
      const unknown = result.warnings.filter((w) => w.code === "unknown_field");
      expect(unknown).toHaveLength(1);
      expect(unknown[0]?.message).toContain("verdict");
    });
  });

  it("warns for an unknown key inside a strict-strip nested block", async () => {
    await withTmpCwd("grove-validate-unknown-nested-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        [
          "kind: project",
          "slug: demo",
          "name: Demo",
          "description: a demo",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [], tier: reviewed }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      const unknown = result.warnings.filter((w) => w.code === "unknown_field");
      expect(unknown).toHaveLength(1);
      expect(unknown[0]?.message).toContain("curation.tier");
    });
  });

  it("does not warn for extra keys in passthrough blocks", async () => {
    await withTmpCwd("grove-validate-passthrough-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      // `links` has a URL catchall and `github` is passthrough, so
      // extra keys there are preserved by design, not discarded.
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        [
          "kind: project",
          "slug: demo",
          "name: Demo",
          "description: a demo",
          "category: tools",
          "links: { matrix: https://example.com/room }",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.warnings.filter((w) => w.code === "unknown_field")).toEqual(
        [],
      );
    });
  });

  it("strict mode: an unknown field fails validation", async () => {
    await withTmpCwd("grove-validate-unknown-strict-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
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
          "provenance: []",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig(), { strict: true });
      expect(result.ok).toBe(false);
      expect(result.warnings.some((w) => w.code === "unknown_field")).toBe(true);
    });
  });
});

describe("validateProject — silent try/catch at line 70 (missing records dir)", () => {
  it("returns a missing_records_dir error, NOT a throw, when recordsDir does not exist", async () => {
    await withTmpCwd("grove-validate-missing-", async () => {
      // validateProject at line 60 checks `exists(recordsDir)` first
      // and emits a `missing_records_dir` error. The brief flagged
      // the readdir at line 70 with a `.catch(() => [])` as audit
      // concern. Pin the *current* behaviour: a missing dir is a
      // top-level error with the code `missing_records_dir`, not a
      // throw and not a silent pass.
      const config = makeConfig({
        paths: {
          recordsDir: "data/does-not-exist",
          generatedDir: "data/generated",
          health: "data/health.yml",
          decisions: "data/decisions.yml",
        },
      } as Partial<GroveConfig>);
      const result = await validateProject(config);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === "missing_records_dir")).toBe(true);
    });
  });
});

describe("validateProject — silent try/catch at lines 54-69 (Zod parse)", () => {
  it("emits zod_error issues for a record missing required fields", async () => {
    await withTmpCwd("grove-validate-bad-fields-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      // project requires `name` (min 1). The minimal stub here is
      // missing it, so Zod should reject with one or more
      // zod_error issues — the validation pipeline's structured
      // error path that CLI's `grove validate` renders.
      await writeFile(
        join(cwd, "data", "records", "broken.yml"),
        [
          "kind: project",
          "slug: broken",
          "description: missing the name field",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // The error code from the Zod try/catch is "zod_error", and
      // the path should mention the missing field ("name").
      const zodErr = result.errors.find((e) => e.code === "zod_error");
      expect(zodErr).toBeDefined();
      expect(zodErr?.message).toContain("name");
    });
  });

  it("emits a schema_error (not zod_error) when the YAML is an empty mapping", async () => {
    await withTmpCwd("grove-validate-empty-yml-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      // Edge case the brief flagged: parseYaml returns `null` for
      // an empty document, and the code at line 79-88 treats that
      // as `schema_error` (not zod_error) because the value never
      // reaches the Zod parse step. Pin the specific code.
      await writeFile(join(cwd, "data", "records", "empty.yml"), "");

      const result = await validateProject(makeConfig());
      expect(result.ok).toBe(false);
      const e = result.errors.find((err) => err.code === "schema_error");
      expect(e).toBeDefined();
      expect(e?.message).toContain("empty");
    });
  });

  it("strict mode: a single warning causes ok=false", async () => {
    await withTmpCwd("grove-validate-strict-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      // Pin the strict-mode contract: any warning becomes a
      // failure. The `slug_mismatch` test above returns ok=true
      // (warnings don't fail by default) — the same record with
      // `strict: true` returns ok=false.
      await writeFile(
        join(cwd, "data", "records", "demo.yml"),
        [
          "kind: project",
          "slug: different-slug",
          "name: Demo",
          "description: a demo",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const lenient = await validateProject(makeConfig());
      expect(lenient.ok).toBe(true);

      const strict = await validateProject(makeConfig(), { strict: true });
      expect(strict.ok).toBe(false);
    });
  });
});

describe("validateProject — decision / health cross-references", () => {
  it("emits unknown_decision_record when a decisions.yml references a non-existent slug", async () => {
    await withTmpCwd("grove-validate-xref-decision-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "real.yml"),
        [
          "kind: project",
          "slug: real",
          "name: Real",
          "description: real record",
          "category: tools",
          "links: {}",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );
      // decisions.yml points at "ghost" which is not in records/
      await writeFile(
        join(cwd, "data", "decisions.yml"),
        [
          "decisions:",
          "  - id: ghost",
          "    decision:",
          "      visibility: hide",
          "      reason: tested as unknown reference",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      const e = result.errors.find((err) => err.code === "unknown_decision_record");
      expect(e).toBeDefined();
      expect(e?.message).toContain("ghost");
    });
  });

  it("emits missing_health when a record points at GitHub but no health.yml exists", async () => {
    await withTmpCwd("grove-validate-xref-health-", async (cwd) => {
      await mkdir(join(cwd, "data", "records"), { recursive: true });
      await writeFile(
        join(cwd, "data", "records", "needs-health.yml"),
        [
          "kind: project",
          "slug: needs-health",
          "name: Needs Health",
          "description: this record points at GitHub",
          "category: tools",
          "links: { github: 'https://github.com/owner/repo' }",
          "curation: { reviewed: false, labels: [], lenses: [] }",
          "scores: {}",
        ].join("\n"),
      );

      const result = await validateProject(makeConfig());
      const w = result.warnings.find((warn) => warn.code === "missing_health_file");
      expect(w).toBeDefined();
    });
  });
});
