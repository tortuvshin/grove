import { describe, expect, it } from "vitest";
import {
  definePageDocument,
  buildJsonLd,
  siteSchema,
  breadcrumbSchema,
  collectionSchema,
  recordSchema,
  contentSchema,
  validateJsonLd,
} from "./page-document.js";

describe("definePageDocument", () => {
  it("requires title and description", () => {
    expect(() =>
      definePageDocument({
        identity: {
          type: "home",
          canonical: new URL("https://example.com/"),
          language: "en",
        },
        metadata: {
          title: "",
          description: "x",
          robots: "index,follow",
          openGraph: {
            title: "x",
            description: "x",
            url: "https://example.com/",
            image: "https://example.com/og.png",
            type: "website",
          },
          twitter: { card: "summary" },
        },
        structuredData: [],
        discovery: {
          includeInSitemap: true,
          includeInLlms: true,
          relatedLinks: [],
        },
      }),
    ).toThrow(/title/);
  });

  it("requires OG URL to match canonical", () => {
    expect(() =>
      definePageDocument({
        identity: {
          type: "home",
          canonical: new URL("https://example.com/"),
          language: "en",
        },
        metadata: {
          title: "Example",
          description: "Example domain",
          robots: "index,follow",
          openGraph: {
            title: "Example",
            description: "Example domain",
            url: "https://other.com/",
            image: "https://example.com/og.png",
            type: "website",
          },
          twitter: { card: "summary" },
        },
        structuredData: [],
        discovery: {
          includeInSitemap: true,
          includeInLlms: true,
          relatedLinks: [],
        },
      }),
    ).toThrow(/canonical/);
  });
});

describe("JSON-LD schemas", () => {
  it("siteSchema produces WebSite + Organization", () => {
    const nodes = siteSchema({
      url: "https://example.com/",
      name: "Example",
      orgName: "Example Org",
      orgUrl: "https://example.com/",
    });
    expect(nodes[0]?.["@type"]).toEqual(["WebSite", "Organization"]);
  });

  it("collectionSchema requires ≥2 breadcrumbs", () => {
    expect(() =>
      collectionSchema({
        url: "https://example.com/c/",
        name: "x",
        description: "x",
        items: [],
        crumbs: [{ url: "https://example.com/", name: "Home" }],
      }),
    ).toThrow(/breadcrumb/);
  });

  it("collectionSchema produces 3 nodes with item count", () => {
    const nodes = collectionSchema({
      url: "https://example.com/c/",
      name: "Top",
      description: "x",
      items: [
        { url: "https://example.com/a/", name: "A" },
        { url: "https://example.com/b/", name: "B" },
      ],
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/c/", name: "Top" },
      ],
    });
    expect(nodes).toHaveLength(3);
    expect((nodes[1] as { numberOfItems?: number }).numberOfItems).toBe(2);
  });

  it("collectionSchema passes item descriptions through", () => {
    const nodes = collectionSchema({
      url: "https://example.com/c/",
      name: "Top",
      description: "x",
      items: [
        { url: "https://example.com/a/", name: "A", description: "First app" },
        { url: "https://example.com/b/", name: "B" },
      ],
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/c/", name: "Top" },
      ],
    });
    const list = nodes[1] as { itemListElement: Array<Record<string, unknown>> };
    expect(list.itemListElement[0]?.description).toBe("First app");
    expect(list.itemListElement[1]).not.toHaveProperty("description");
  });

  it("siteSchema emits inLanguage and publisher sameAs when given", () => {
    const [node] = siteSchema({
      url: "https://example.com",
      name: "Example",
      orgName: "Example",
      orgUrl: "https://example.com",
      inLanguage: "en",
      sameAs: ["https://github.com/example/repo"],
    });
    expect(node?.inLanguage).toBe("en");
    expect((node?.publisher as { sameAs?: string[] }).sameAs).toEqual([
      "https://github.com/example/repo",
    ]);
  });

  it("breadcrumbSchema builds positioned ListItems", () => {
    const node = breadcrumbSchema([
      { url: "https://example.com/", name: "Home" },
      { url: "https://example.com/c/", name: "C" },
    ]);
    expect(node["@type"]).toBe("BreadcrumbList");
    const items = node.itemListElement as Array<{ position: number; item: string }>;
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(items[1]?.item).toBe("https://example.com/c/");
  });

  it("recordSchema branches on kind", () => {
    const app = recordSchema({
      url: "https://example.com/a/",
      name: "A",
      description: "x",
      kind: "application",
      repoUrl: "https://github.com/a/b",
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/a/", name: "A" },
      ],
    });
    expect(app[0]?.["@type"]).toEqual(["SoftwareApplication", "SoftwareSourceCode"]);

    const art = recordSchema({
      url: "https://example.com/a/",
      name: "A",
      description: "x",
      kind: "article",
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/a/", name: "A" },
      ],
    });
    expect(art[0]?.["@type"]).toEqual(["CreativeWork", "WebPage"]);
  });

  it("contentSchema produces Article + BreadcrumbList", () => {
    const nodes = contentSchema({
      url: "https://example.com/about/",
      headline: "About",
      description: "x",
      author: "Example Org",
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/about/", name: "About" },
      ],
    });
    expect(nodes.map((n) => n["@type"])).toEqual([
      ["Article", "WebPage"],
      "BreadcrumbList",
    ]);
  });
});

describe("buildJsonLd", () => {
  it("dispatches to recordSchema", () => {
    const nodes = buildJsonLd({
      url: "https://example.com/a/",
      name: "A",
      description: "x",
      kind: "application",
      crumbs: [
        { url: "https://example.com/", name: "Home" },
        { url: "https://example.com/a/", name: "A" },
      ],
    });
    expect(nodes[0]?.["@type"]).toEqual(["SoftwareApplication", "SoftwareSourceCode"]);
  });
});

describe("validateJsonLd", () => {
  it("flags missing @context", () => {
    const issues = validateJsonLd([{ "@type": "WebSite" } as never]);
    expect(issues.some((i) => i.code === "missing-context")).toBe(true);
  });
  it("flags relative URLs", () => {
    const issues = validateJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: "/relative",
      },
    ]);
    expect(issues.some((i) => i.code === "relative-url")).toBe(true);
  });
  it("flags duplicate @id", () => {
    const a = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "x",
    };
    const b = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "x",
    };
    expect(validateJsonLd([a, b]).some((i) => i.code === "duplicate-id")).toBe(
      true,
    );
  });
});
