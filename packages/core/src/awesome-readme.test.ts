import { describe, expect, it } from "vitest";
import {
  buildAwesomeReadme,
  injectAwesomeReadmeBlock,
  parseAwesomeReadmeSections,
} from "./awesome-readme.js";

const baseInput = {
  generatedAt: "2026-07-30T00:00:00.000Z",
  site: {
    name: "Open Apps",
    description: "Open-source apps worth running.",
    url: "https://open-apps.dev.mn",
  },
  categories: [
    { id: "agents", name: "Agents" },
    { id: "interfaces", name: "Interfaces" },
    { id: "local-models", name: "Local Models" },
  ],
  records: [
    {
      slug: "crewai",
      name: "CrewAI",
      description: "Python framework for coordinating role-based autonomous agents",
      category: "agents",
      repoUrl: "https://github.com/crewAIInc/crewAI",
      homepageUrl: "https://crewai.com",
      stars: 32000,
      visibility: "keep",
    },
    {
      slug: "open-webui",
      name: "Open WebUI",
      description: "Self-hosted LLM chat interface.",
      category: "interfaces",
      repoUrl: "https://github.com/open-webui/open-webui",
      stars: 78000,
      visibility: "keep",
    },
    {
      slug: "ollama",
      name: "Ollama",
      description: "Run open-source LLMs locally",
      category: "local-models",
      repoUrl: "https://github.com/ollama/ollama",
      homepageUrl: "https://ollama.com",
      visibility: "keep",
    },
  ],
};

describe("buildAwesomeReadme", () => {
  it("includes the awesome badge under H1", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain("# Open Apps");
    expect(md).toContain("https://awesome.re/badge.svg");
  });

  it("groups records under category H2 sections in declared order", () => {
    const md = buildAwesomeReadme(baseInput);
    const agentsIdx = md.indexOf("## Agents");
    const interfacesIdx = md.indexOf("## Interfaces");
    const localModelsIdx = md.indexOf("## Local Models");
    expect(agentsIdx).toBeGreaterThan(-1);
    expect(interfacesIdx).toBeGreaterThan(agentsIdx);
    expect(localModelsIdx).toBeGreaterThan(interfacesIdx);
  });

  it("builds the Contents TOC anchored to each category", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain("## Contents");
    expect(md).toContain("- [Agents](#agents)");
    expect(md).toContain("- [Interfaces](#interfaces)");
    expect(md).toContain("- [Local Models](#local-models)");
  });

  it("formats entries as `[Name](URL) - Description.`", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain(
      "- [CrewAI](https://crewai.com) - Python framework for coordinating role-based autonomous agents.",
    );
    expect(md).toContain(
      "- [Open WebUI](https://github.com/open-webui/open-webui) - Self-hosted LLM chat interface.",
    );
  });

  it("prefers homepageUrl over repoUrl", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain("[CrewAI](https://crewai.com)");
    expect(md).not.toContain("[CrewAI](https://github.com/crewAIInc/crewAI)");
  });

  it("falls back to repoUrl when homepage is absent", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain("[Open WebUI](https://github.com/open-webui/open-webui)");
  });

  it("sorts entries alphabetically within a category (case-insensitive)", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      records: [
        {
          slug: "zebra",
          name: "Zebra Tool",
          description: "Z.",
          category: "agents",
          repoUrl: "https://example.com/zebra",
        },
        {
          slug: "apple",
          name: "apple agent",
          description: "A.",
          category: "agents",
          repoUrl: "https://example.com/apple",
        },
        {
          slug: "Banana",
          name: "Banana",
          description: "B.",
          category: "agents",
          repoUrl: "https://example.com/banana",
        },
      ],
    });
    const apple = md.indexOf("apple agent");
    const banana = md.indexOf("Banana");
    const zebra = md.indexOf("Zebra Tool");
    expect(apple).toBeGreaterThan(-1);
    expect(banana).toBeGreaterThan(apple);
    expect(zebra).toBeGreaterThan(banana);
  });

  it("skips records with visibility hide or remove", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      records: [
        ...baseInput.records,
        {
          slug: "hidden",
          name: "Hidden Tool",
          description: "Should not appear.",
          category: "agents",
          repoUrl: "https://example.com/hidden",
          visibility: "hide",
        },
        {
          slug: "removed",
          name: "Removed Tool",
          description: "Should not appear.",
          category: "agents",
          repoUrl: "https://example.com/removed",
          visibility: "remove",
        },
      ],
    });
    expect(md).not.toContain("Hidden Tool");
    expect(md).not.toContain("Removed Tool");
  });

  it("appends a trailing period to descriptions that lack one", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).toContain(
      "Python framework for coordinating role-based autonomous agents.",
    );
    expect(md).toContain("Run open-source LLMs locally.");
  });

  it("does not double up trailing periods", () => {
    const md = buildAwesomeReadme(baseInput);
    expect(md).not.toContain("Self-hosted LLM chat interface..");
  });

  it("falls back to an Other section for records with an unknown category", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      records: [
        ...baseInput.records,
        {
          slug: "mystery",
          name: "Mystery Project",
          description: "An outlier.",
          category: "uncategorized",
          repoUrl: "https://example.com/mystery",
        },
      ],
    });
    expect(md).toContain("## Uncategorized");
    expect(md).toContain("- [Mystery Project]");
  });

  it("skips records missing both name and slug", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      records: [
        ...baseInput.records,
        {
          slug: "",
          name: "",
          description: "Should be skipped.",
          category: "agents",
          repoUrl: "https://example.com/x",
        } as never,
      ],
    });
    expect(md).not.toContain("Should be skipped.");
  });

  it("uses repo URL when both homepage and repo are missing", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      records: [
        {
          slug: "no-url",
          name: "No URL Project",
          description: "Has no URL at all.",
          category: "agents",
        },
      ],
    });
    expect(md).not.toContain("[No URL Project]()");
    expect(md).toContain("No URL Project");
  });
});

describe("buildAwesomeReadme — readme config", () => {
  it("uses site.name as the H1 when readme.title is absent", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, name: "Original Name" },
    });
    expect(md.split("\n")[0]).toBe("# Original Name");
  });

  it("overrides the H1 with readme.title", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      readme: { title: "Custom README Title" },
    });
    expect(md.split("\n")[0]).toBe("# Custom README Title");
    expect(md).not.toContain("# Open Apps");
  });

  it("overrides the after-badge description with readme.tagline", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, tagline: "Original tagline." },
      readme: { tagline: "Curated by humans." },
    });
    expect(md).toContain("Curated by humans.");
    expect(md).not.toContain("Original tagline.");
  });

  it("falls back to site.tagline when readme.tagline is absent", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, tagline: "Site tagline here." },
    });
    expect(md).toContain("Site tagline here.");
  });

  it("uses readme.url for the browse link when provided", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, url: "https://fallback.example" },
      readme: { url: "https://docs.example.com" },
    });
    expect(md).toContain("Browse the full directory → https://docs.example.com");
    expect(md).not.toContain("fallback.example");
  });

  it("uses a custom browseLabel when provided", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, url: "https://example.com" },
      readme: { browseLabel: "Open the catalog →" },
    });
    expect(md).toContain("Open the catalog → https://example.com");
  });

  it("hides the awesome badge when showBadge is false", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      readme: { showBadge: false },
    });
    expect(md).not.toContain("https://awesome.re/badge.svg");
  });

  it("hides the Contents TOC when showToc is false", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      readme: { showToc: false },
    });
    expect(md).not.toContain("## Contents");
    expect(md).toContain("## Agents");
  });

  it("hides the browse link when showBrowseLink is false", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      site: { ...baseInput.site, url: "https://example.com" },
      readme: { showBrowseLink: false },
    });
    expect(md).not.toContain("Browse the full directory");
  });

  it("renders an optional markdown intro after the H1 and before the TOC", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      readme: { intro: "## Welcome\n\nThis is a hand-written intro paragraph." },
    });
    const titleIdx = md.indexOf("# Open Apps");
    const welcomeIdx = md.indexOf("## Welcome");
    const tocIdx = md.indexOf("## Contents");
    expect(welcomeIdx).toBeGreaterThan(titleIdx);
    expect(tocIdx).toBeGreaterThan(welcomeIdx);
    expect(md).toContain("This is a hand-written intro paragraph.");
  });

  it("preserves the badge, TOC, and sections by default", () => {
    const md = buildAwesomeReadme({
      ...baseInput,
      readme: {},
    });
    expect(md).toContain("https://awesome.re/badge.svg");
    expect(md).toContain("## Contents");
    expect(md).toContain("Browse the full directory");
  });
});

describe("parseAwesomeReadmeSections", () => {
  it("returns before, entries, after when both sentinels are present", () => {
    const input = `# Title

Intro.

<!-- grove-readme:start -->
old entries
<!-- grove-readme:end -->

Footer.`;
    const sections = parseAwesomeReadmeSections(input);
    expect(sections.before).toContain("# Title");
    expect(sections.entries).toBe("\nold entries\n");
    expect(sections.after).toContain("Footer.");
  });

  it("returns the full content as before when sentinels are absent", () => {
    const input = `# Title\n\nNo sentinels here.`;
    const sections = parseAwesomeReadmeSections(input);
    expect(sections.before).toBe(input);
    expect(sections.entries).toBe("");
    expect(sections.after).toBe("");
  });
});

describe("injectAwesomeReadmeBlock", () => {
  it("replaces the content between sentinels in place", () => {
    const original = `# Title

<!-- grove-readme:start -->
old
<!-- grove-readme:end -->
`;
    const out = injectAwesomeReadmeBlock(original, "## New\n\n- a");
    expect(out).toContain("# Title");
    expect(out).toContain("## New");
    expect(out).toContain("- a");
    expect(out).not.toContain("old");
    expect(out.indexOf("## New")).toBeLessThan(out.indexOf("# Title") + 1000);
  });

  it("appends the sentinel block when sentinels are absent", () => {
    const original = `# Title\n\nIntro.`;
    const out = injectAwesomeReadmeBlock(original, "## Body\n\n- a");
    expect(out).toContain("# Title");
    expect(out.indexOf("## Body")).toBeGreaterThan(out.indexOf("Intro."));
    expect(out).toContain("<!-- grove-readme:start -->");
    expect(out).toContain("<!-- grove-readme:end -->");
  });
});