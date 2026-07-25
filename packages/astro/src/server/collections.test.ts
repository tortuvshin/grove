import { describe, expect, it } from "vitest";
import {
  recordsToCollectionEntries,
  getCollectionPageModel,
  getCollectionIndexModel,
  getCollectionTeaserModel,
} from "./collections.js";
import type { Collection, CollectionEntry } from "@grove-dev/core";

describe("recordsToCollectionEntries", () => {
  it("maps a full record to a CollectionEntry", () => {
    const records = [
      {
        slug: "crewai",
        name: "CrewAI",
        description: "Agent framework",
        stack: "python",
        stacks: ["python"],
        platforms: ["linux", "macos"],
        license: "MIT",
        visibility: "keep",
        stars: 100,
        pushedAt: "2026-01-15T00:00:00Z",
        lastCommitAt: "2026-02-01T00:00:00Z",
        category: "agents",
        tags: ["multi-agent", "automation"],
        scores: { curation: 0.8, activity: 0.7 },
      },
    ];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: "projects" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      slug: "crewai",
      title: "CrewAI",
      description: "Agent framework",
      url: "/projects/crewai/",
      stack: "python",
      platform: ["linux", "macos"],
      license: "MIT",
      status: "keep",
      stars: 100,
      pushedAt: "2026-01-15T00:00:00Z",
      curationScore: 0.8,
      activityScore: 0.7,
      categories: expect.arrayContaining(["agents", "multi-agent", "automation"]),
    });
  });

  it("filters out hidden records", () => {
    const records = [
      { slug: "a", name: "A", visibility: "keep" },
      { slug: "b", name: "B", visibility: "hide" },
    ];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: "projects" });
    expect(entries.map((e) => e.slug)).toEqual(["a"]);
  });

  it("falls back to stacks[0] when stack is missing", () => {
    const records = [{ slug: "x", name: "X", stacks: ["node"] }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: "projects" });
    expect(entries[0].stack).toBe("node");
  });

  it("prefers lastCommitAt when pushedAt is missing", () => {
    const records = [{ slug: "x", name: "X", lastCommitAt: "2026-03-01T00:00:00Z" }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: "projects" });
    expect(entries[0].pushedAt).toBe("2026-03-01T00:00:00Z");
  });

  it("deduplicates categories when category is also in tags", () => {
    const records = [{ slug: "x", name: "X", category: "agents", tags: ["agents", "x"] }];
    const entries = recordsToCollectionEntries(records as never, { routeSlug: "projects" });
    expect(entries[0].categories).toEqual(["agents", "x"]);
  });

  it("defaults routeSlug to 'projects' when not provided", () => {
    const records = [{ slug: "x", name: "X" }];
    const entries = recordsToCollectionEntries(records as never, {});
    expect(entries[0].url).toBe("/projects/x/");
  });
});

const collection: Collection = {
  slug: "top-ai-agents",
  kind: "curated",
  title: "Top AI Agents",
  description: "Best agent frameworks.",
  query: { stacks: ["python"] },
  ranking: { preset: "quality" },
  seo: { index: true },
  editorial: { selectionNote: "Ranked by activity and curation." },
};

const otherCollection: Collection = {
  slug: "top-tools",
  kind: "curated",
  title: "Top Tools",
  description: "All tools.",
  query: { stacks: ["python"] },
  ranking: { preset: "recency" },
  seo: { index: true },
};

const emptyCollection: Collection = {
  slug: "no-matches",
  kind: "curated",
  title: "No Matches",
  description: "Won't match anything.",
  query: { stacks: ["rust"] },
  ranking: { preset: "recency" },
  seo: { index: true },
};

const entries: CollectionEntry[] = [
  {
    slug: "crewai",
    title: "CrewAI",
    description: "Agent framework",
    url: "/projects/crewai/",
    stack: "python",
    curationScore: 0.9,
    activityScore: 0.8,
  },
  {
    slug: "dify",
    title: "Dify",
    description: "LLM platform",
    url: "/projects/dify/",
    stack: "python",
    curationScore: 0.7,
    activityScore: 0.6,
  },
  {
    slug: "flowise",
    title: "Flowise",
    description: "Node tool",
    url: "/projects/flowise/",
    stack: "node",
    curationScore: 0.5,
    activityScore: 0.4,
  },
];

describe("getCollectionPageModel", () => {
  it("returns ranked entries filtered by query", () => {
    const model = getCollectionPageModel(collection, entries, [collection, otherCollection]);
    expect(model.total).toBe(2);
    expect(model.isEmpty).toBe(false);
    expect(model.entries.map((e) => e.slug)).toEqual(["crewai", "dify"]);
  });

  it("exposes editorial selection note", () => {
    const model = getCollectionPageModel(collection, entries, [collection]);
    expect(model.collection.selectionNote).toBe("Ranked by activity and curation.");
  });

  it("returns related collections (max 4)", () => {
    const model = getCollectionPageModel(collection, entries, [collection, otherCollection]);
    expect(model.related).toHaveLength(1);
    expect(model.related[0].slug).toBe("top-tools");
  });

  it("reports empty when no entries match", () => {
    const model = getCollectionPageModel(emptyCollection, entries, [collection, otherCollection]);
    expect(model.isEmpty).toBe(true);
  });
});

describe("getCollectionIndexModel", () => {
  it("counts entries per collection", () => {
    const model = getCollectionIndexModel([collection, otherCollection], entries);
    expect(model.total).toBe(2);
    expect(model.collections).toHaveLength(2);
    const agentCol = model.collections.find((c) => c.slug === "top-ai-agents");
    expect(agentCol?.count).toBe(2);
    expect(agentCol?.url).toBe("/collections/top-ai-agents/");
  });
});

describe("getCollectionTeaserModel", () => {
  it("respects the limit", () => {
    const model = getCollectionTeaserModel([collection, otherCollection], entries, 1);
    expect(model.collections).toHaveLength(1);
  });

  it("uses the project's route slug for entry URLs", () => {
    const model = getCollectionTeaserModel([collection], entries, 5);
    expect(model.collections[0].count).toBe(2);
  });
});
