/**
 * Real-module tests for `buildProjectCardModel` — the presentation
 * view-model builder that lets `ProjectCard.astro` stay pure
 * presentation (see `v1-architecture.md` §7-14).
 *
 * `models.ts` transitively imports `@grove/generated/*.json` at module
 * load (via `directory.ts`), so — like `models-home.test.ts` — the
 * generated build artifacts are mocked to import the real
 * implementation instead of re-deriving it.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@grove/generated/records.full.json", () => ({ default: { records: [] } }));
vi.mock("@grove/generated/records.index.json", () => ({ default: { records: [] } }));
vi.mock("@grove/generated/site-config.json", () => ({ default: {} }));

const { buildProjectCardModel } = await import("./models.js");

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    kind: "project" as const,
    slug: "demo-app",
    name: "Demo App",
    description: "A demo project record.",
    category: "tools",
    tags: [],
    stack: "python",
    stacks: ["python"],
    platforms: ["linux"],
    licenses: [],
    repoUrl: "https://github.com/acme/demo-app",
    logoUrl: undefined,
    github: {
      stars: 1234,
      pushedAt: "2026-01-01T00:00:00Z",
    },
    links: {},
    curation: { reviewed: true, labels: [], lenses: [] },
    visibility: "keep",
    ...overrides,
  };
}

function resourceRecord(overrides: Record<string, unknown> = {}) {
  return {
    kind: "resource" as const,
    slug: "demo-article",
    title: "Demo Article",
    description: "A demo resource record.",
    category: "guides",
    tags: [],
    type: "article",
    topic: "general",
    related: [],
    publishedAt: "2026-01-15T00:00:00Z",
    links: {},
    curation: { reviewed: true, labels: [], lenses: [] },
    visibility: "keep",
    ...overrides,
  };
}

describe("buildProjectCardModel", () => {
  it("derives fields from a project record", () => {
    const model = buildProjectCardModel(projectRecord() as never);
    expect(model.name).toBe("Demo App");
    expect(model.slug).toBe("demo-app");
    expect(model.description).toBe("A demo project record.");
    expect(model.owner).toBe("acme");
    expect(model.repo).toBe("demo-app");
    expect(model.repoHref).toBe("https://github.com/acme/demo-app");
    expect(model.isArticle).toBe(true);
    expect(model.stars).toBe(1234);
    expect(model.starsLabel).toBe("1.2k");
    expect(model.hasStars).toBe(true);
    expect(model.pushedAt).toBe("2026-01-01T00:00:00Z");
    expect(model.hasUpdated).toBe(true);
    expect(model.stackIds).toEqual(["python"]);
  });

  it("derives fields from a resource record", () => {
    const model = buildProjectCardModel(resourceRecord() as never);
    expect(model.name).toBe("Demo Article");
    expect(model.description).toBe("A demo resource record.");
    expect(model.pushedAt).toBe("2026-01-15T00:00:00Z");
    expect(model.hasUpdated).toBe(true);
    // Resources carry no stack/github data.
    expect(model.stackIds).toEqual([]);
    expect(model.hasStars).toBe(false);
    expect(model.isArticle).toBe(false);
  });

  it("lets an explicit override win over the record-derived value", () => {
    const model = buildProjectCardModel(projectRecord() as never, {
      name: "Overridden Name",
    });
    expect(model.name).toBe("Overridden Name");
    // Everything else still derives from the record.
    expect(model.description).toBe("A demo project record.");
  });

  it("resolves isArticle to false when the record has no repo URL", () => {
    const model = buildProjectCardModel(
      projectRecord({ repoUrl: undefined, links: {} }) as never,
    );
    expect(model.repoHref).toBeUndefined();
    expect(model.owner).toBeUndefined();
    expect(model.repo).toBeUndefined();
    expect(model.isArticle).toBe(false);
  });

  it("caps visibleStacks at 4 and reports the overflow count", () => {
    const model = buildProjectCardModel(
      projectRecord({
        stack: "a",
        stacks: ["a", "b", "c", "d", "e", "f"],
      }) as never,
    );
    expect(model.stackIds).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(model.visibleStacks).toEqual(["a", "b", "c", "d"]);
    expect(model.stackOverflow).toBe(2);
    expect(model.hasStacks).toBe(true);
  });
});
