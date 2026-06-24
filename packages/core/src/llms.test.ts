import { describe, expect, it } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt } from "./llms.js";
import type { GroveConfig } from "./schema.js";

const config = {
  blueprint: "project-directory",
  site: {
    name: "Open Apps",
    tagline: "Open-source apps with real codebases.",
    url: "https://open-apps.dev.mn",
  },
  routes: { directory: "apps" },
  labels: { singular: "app", plural: "apps" },
} as GroveConfig;

const input = {
  generatedAt: "2026-06-24T00:00:00.000Z",
  records: [
    {
      slug: "immich",
      name: "Immich",
      description: "Self-hosted photo backup.",
      category: "tools",
      stack: "flutter",
    },
  ],
};

describe("LLM outputs", () => {
  it("uses the configured directory route in the compact index", () => {
    const text = buildLlmsTxt(input, config);

    expect(text).toContain("Directory: https://open-apps.dev.mn/apps");
    expect(text).not.toContain("/projects");
  });

  it("uses configured route and plural label in the full index", () => {
    const text = buildLlmsFullTxt(input, config);

    expect(text).toContain("> Source: https://open-apps.dev.mn/apps");
    expect(text).toContain("## Apps");
    expect(text).toContain("- url: https://open-apps.dev.mn/apps/immich");
    expect(text).not.toContain("/projects");
  });
});
