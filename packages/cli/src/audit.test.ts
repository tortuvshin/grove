import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import {
  aggregateRuns,
  extractMetrics,
  extractScores,
  loadManifest,
  parseAuditBlock,
  parsePageEntry,
  propName,
} from "./audit.js";
import type {
  AuditResult,
  LighthouseMetrics,
  LighthouseScores,
  PageType,
  Profile,
} from "@grove-dev/core";

function parseObjectExpression(source: string): ts.ObjectLiteralExpression {
  // Wrap in parens so a leading `{` is parsed as an object literal rather
  // than a block statement.
  const sf = ts.createSourceFile("t.ts", `(${source})`, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const outer = (sf.statements[0] as ts.ExpressionStatement).expression;
  const inner = ts.isParenthesizedExpression(outer) ? outer.expression : outer;
  return inner as ts.ObjectLiteralExpression;
}

function parseObjectFromDefineCall(source: string): ts.ObjectLiteralExpression {
  const sf = ts.createSourceFile("t.ts", source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const stmt = sf.statements[0] as ts.ExpressionStatement;
  const call = stmt.expression as ts.CallExpression;
  return call.arguments[0] as ts.ObjectLiteralExpression;
}

function parsePropertyName(source: string): ts.PropertyName {
  const sf = ts.createSourceFile("t.ts", `const x = { ${source}: 1 };`, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const obj = ((sf.statements[0] as ts.VariableStatement).declarationList.declarations[0]!.initializer as ts.ObjectLiteralExpression);
  return (obj.properties[0] as ts.PropertyAssignment).name;
}

describe("propName", () => {
  it("returns identifier text", () => {
    expect(propName(parsePropertyName("foo"))).toBe("foo");
  });

  it("returns string literal text", () => {
    expect(propName(parsePropertyName('"foo-bar"'))).toBe("foo-bar");
  });

  it("returns numeric literal text", () => {
    expect(propName(parsePropertyName("123"))).toBe("123");
  });

  it("returns computed property text", () => {
    expect(propName(parsePropertyName("[expr]"))).toBe("[expr]");
  });
});

describe("parseAuditBlock", () => {
  it("parses baseUrl only", () => {
    const result = parseAuditBlock(parseObjectExpression('{ baseUrl: "https://example.com" }'));
    expect(result.baseUrl).toBe("https://example.com");
    expect(result.pages).toEqual([]);
  });

  it("parses pages only", () => {
    const result = parseAuditBlock(parseObjectExpression('{ pages: [{ path: "/", type: "home", label: "Home" }] }'));
    expect(result.baseUrl).toBeUndefined();
    expect(result.pages).toEqual([{ path: "/", type: "home", label: "Home" }]);
  });

  it("parses both baseUrl and pages", () => {
    const result = parseAuditBlock(parseObjectExpression(
      '{ baseUrl: "https://example.com", pages: [{ path: "/", type: "home", label: "Home" }] }',
    ));
    expect(result.baseUrl).toBe("https://example.com");
    expect(result.pages).toEqual([{ path: "/", type: "home", label: "Home" }]);
  });
});

describe("parsePageEntry", () => {
  it("parses all 3 fields", () => {
    const entry = parsePageEntry(parseObjectExpression('{ path: "/foo", type: "directory", label: "Foo" }'));
    expect(entry).toEqual({ path: "/foo", type: "directory", label: "Foo" });
  });

  it("returns defaults when fields are missing", () => {
    const entry = parsePageEntry(parseObjectExpression("{}"));
    expect(entry).toEqual({ path: "", type: "home", label: "" });
  });
});

describe("extractScores", () => {
  it("extracts scores from typical Lighthouse output", () => {
    const lhr = {
      categories: {
        performance: { score: 0.9 },
        accessibility: { score: 0.95 },
        "best-practices": { score: 1 },
        seo: { score: 0.85 },
      },
    } as unknown as Parameters<typeof extractScores>[0];
    const scores: LighthouseScores = extractScores(lhr);
    expect(scores).toEqual({
      performance: 0.9,
      accessibility: 0.95,
      bestPractices: 1,
      seo: 0.85,
    });
  });

  it("returns 0 for missing categories", () => {
    const lhr = { categories: {} } as unknown as Parameters<typeof extractScores>[0];
    const scores = extractScores(lhr);
    expect(scores).toEqual({ performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });
  });

  it("handles undefined categories object", () => {
    const lhr = {} as unknown as Parameters<typeof extractScores>[0];
    const scores = extractScores(lhr);
    expect(scores).toEqual({ performance: 0, accessibility: 0, bestPractices: 0, seo: 0 });
  });
});

describe("extractMetrics", () => {
  it("extracts metrics from typical Lighthouse output", () => {
    const lhr = {
      audits: {
        "largest-contentful-paint": { numericValue: 1500 },
        "cumulative-layout-shift": { numericValue: 0.02 },
        "total-blocking-time": { numericValue: 50 },
      },
    } as unknown as Parameters<typeof extractMetrics>[0];
    const metrics: LighthouseMetrics = extractMetrics(lhr);
    expect(metrics).toEqual({ lcp: 1500, cls: 0.02, tbt: 50 });
  });

  it("returns Infinity for missing audits", () => {
    const lhr = { audits: {} } as unknown as Parameters<typeof extractMetrics>[0];
    const metrics = extractMetrics(lhr);
    expect(metrics).toEqual({ lcp: Infinity, cls: Infinity, tbt: Infinity });
  });

  it("handles undefined audits object", () => {
    const lhr = {} as unknown as Parameters<typeof extractMetrics>[0];
    const metrics = extractMetrics(lhr);
    expect(metrics).toEqual({ lcp: Infinity, cls: Infinity, tbt: Infinity });
  });
});

describe("aggregateRuns", () => {
  const baseRun = {
    url: "https://example.com/",
    type: "home" as PageType,
    profile: "mobile" as Profile,
    scores: { performance: 1, accessibility: 1, bestPractices: 1, seo: 1 } as LighthouseScores,
    metrics: { lcp: 1000, cls: 0, tbt: 0 } as LighthouseMetrics,
    durationMs: 100,
  };

  it("uses the middle value for an odd-length list", () => {
    const runs: Array<Omit<AuditResult, "runs">> = [
      { ...baseRun, metrics: { lcp: 100, cls: 0.01, tbt: 10 }, durationMs: 100 },
      { ...baseRun, metrics: { lcp: 200, cls: 0.02, tbt: 20 }, durationMs: 200 },
      { ...baseRun, metrics: { lcp: 300, cls: 0.03, tbt: 30 }, durationMs: 300 },
    ];
    const result = aggregateRuns("https://example.com/", "home", "mobile", runs);
    expect(result.metrics.lcp).toBe(200);
    expect(result.metrics.cls).toBe(0.02);
    expect(result.metrics.tbt).toBe(20);
    expect(result.runs).toBe(3);
  });

  it("uses the average of the two middles for an even-length list", () => {
    const runs: Array<Omit<AuditResult, "runs">> = [
      { ...baseRun, metrics: { lcp: 100, cls: 0.01, tbt: 10 }, durationMs: 100 },
      { ...baseRun, metrics: { lcp: 200, cls: 0.02, tbt: 20 }, durationMs: 200 },
      { ...baseRun, metrics: { lcp: 300, cls: 0.03, tbt: 30 }, durationMs: 300 },
      { ...baseRun, metrics: { lcp: 400, cls: 0.04, tbt: 40 }, durationMs: 400 },
    ];
    const result = aggregateRuns("https://example.com/", "home", "mobile", runs);
    expect(result.metrics.lcp).toBe(250);
    expect(result.metrics.cls).toBe(0.025);
    expect(result.metrics.tbt).toBe(25);
    expect(result.runs).toBe(4);
  });

  it("handles a single run", () => {
    const runs: Array<Omit<AuditResult, "runs">> = [
      { ...baseRun, metrics: { lcp: 500, cls: 0.01, tbt: 5 }, durationMs: 100 },
    ];
    const result = aggregateRuns("https://example.com/", "home", "mobile", runs);
    expect(result.metrics.lcp).toBe(500);
    expect(result.metrics.cls).toBe(0.01);
    expect(result.metrics.tbt).toBe(5);
    expect(result.runs).toBe(1);
  });

  it("throws for an empty list", () => {
    expect(() => aggregateRuns("https://example.com/", "home", "mobile", [])).toThrow();
  });

  it("uses the maximum durationMs across runs", () => {
    const runs: Array<Omit<AuditResult, "runs">> = [
      { ...baseRun, durationMs: 100 },
      { ...baseRun, durationMs: 500 },
      { ...baseRun, durationMs: 200 },
    ];
    const result = aggregateRuns("https://example.com/", "home", "mobile", runs);
    expect(result.durationMs).toBe(500);
  });
});

describe("loadManifest", () => {
  async function withConfig(source: string, fn: (cwd: string) => Promise<void>): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), "grove-audit-"));
    try {
      await writeFile(join(dir, "grove.config.ts"), source, "utf8");
      await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("loads bare defineConfig({...}) form", async () => {
    await withConfig(
      'defineConfig({ audit: { baseUrl: "https://example.com", pages: [{ path: "/", type: "home", label: "Home" }] } });',
      async (cwd) => {
        const manifest = await loadManifest(cwd);
        expect(manifest.baseUrl).toBe("https://example.com");
        expect(manifest.pages).toEqual([{ path: "/", type: "home", label: "Home" }]);
      },
    );
  });

  it("loads export default defineConfig({...}) form", async () => {
    await withConfig(
      'export default defineConfig({ audit: { pages: [{ path: "/", type: "home", label: "Home" }] } });',
      async (cwd) => {
        const manifest = await loadManifest(cwd);
        expect(manifest.baseUrl).toBe("http://127.0.0.1:4321");
        expect(manifest.pages).toEqual([{ path: "/", type: "home", label: "Home" }]);
      },
    );
  });

  it("throws when audit.pages is missing", async () => {
    await withConfig("export default defineConfig({});", async (cwd) => {
      await expect(loadManifest(cwd)).rejects.toThrow(/audit\.pages/);
    });
  });

  it("throws for an invalid page type", async () => {
    await withConfig(
      'export default defineConfig({ audit: { pages: [{ path: "/x", type: "bogus", label: "X" }] } });',
      async (cwd) => {
        await expect(loadManifest(cwd)).rejects.toThrow(/Invalid page type/);
      },
    );
  });
});

// Reference: these exercise the public surface of the exported helpers.
// parseObjectFromDefineCall is intentionally retained as a sibling helper
// to parseObjectExpression so future tests for the `defineConfig` wrapping
// can reuse it.
void parseObjectFromDefineCall;
