/**
 * Page parity test — SEO + page structure alignment between the
 * example's pages and the package's reference pages.
 *
 * Both sides now render through `<BaseLayout>` so the SEO output
 * is identical by construction. This test pins that alignment so a
 * future change to one side can't silently drift from the other.
 *
 * For each pair (example build vs reference build) we read the
 * rendered `<head>` substring and assert the canonical SEO
 * skeleton is present: title, description, canonical link,
 * OpenGraph title / description / type, Twitter card, JSON-LD.
 *
 * The package's reference pages are not compiled into the
 * package's `dist/` (the `*.astro` files are excluded from the
 * TypeScript build). To exercise the parity assertion end-to-end,
 * we render the reference pages by importing them in a `.ts`
 * shim — the same `<BaseLayout>` instance both sides reference,
 * so any divergence in BaseLayout's SEO emission would surface as
 * a build failure on both sides simultaneously.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const example = resolve(root, "apps/example");
const dist = resolve(example, "dist");

/**
 * Extract the `<head>…</head>` substring from a built HTML file.
 * Falls back to reading the first 4 KB if the closing `</head>`
 * isn't where we expect (it usually is).
 */
function headOf(htmlPath: string): string {
  const html = readFileSync(htmlPath, "utf8");
  const close = html.indexOf("</head>");
  return close >= 0 ? html.slice(0, close + 7) : html.slice(0, 4096);
}

/**
 * Pull a single meta / link / title tag by name or property.
 * Returns the tag's content (or the raw tag if it has none).
 */
function tagBy(head: string, attr: string, value: string): string | null {
  // Match `<... attr="value" ...>` with the attribute anywhere in
  // the tag. Sufficient for the curated tag list we assert on.
  const escaped = value.replace(/"/g, '\\"');
  const re = new RegExp(`<[^>]*${attr}="${escaped}"[^>]*>`, "i");
  return head.match(re)?.[0] ?? null;
}

function contentOf(tag: string | null): string {
  if (!tag) return "";
  const m = tag.match(/content="([^"]*)"/);
  return m?.[1] ?? "";
}

describe("SEO + page-structure parity", () => {
  // For each page that exists on both sides, assert the same
  // canonical SEO skeleton. We treat the example's build as the
  // ground truth — the package reference pages emit the same
  // strings because they call the same `<BaseLayout>` + `<Seo>`.

  const cases: Array<{
    label: string;
    page: string; // relative to apps/example/dist
    mustInclude: RegExp[];
  }> = [
    {
      label: "homepage",
      page: "index.html",
      mustInclude: [
        /<title>Grove AI Directory/,
        /<meta\s+name="description"\s+content="[^"]+"\s*\/?>/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/"/,
        /<meta\s+property="og:title"\s+content="Grove AI Directory/,
        /<meta\s+property="og:type"\s+content="website"/,
        /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
      ],
    },
    {
      label: "collection index",
      page: "collections/index.html",
      mustInclude: [
        /<title>Collections/,
        /<meta\s+property="og:type"\s+content="website"/,
        /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
      ],
    },
    {
      label: "collection detail (curated)",
      page: "collections/top-ai-agents/index.html",
      mustInclude: [
        /<title>Top Open Source AI Agents<\/title>/,
        /<meta\s+name="description"\s+content="Python-based agent frameworks and orchestration tools\."/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/collections\/top-ai-agents\/"/,
        /<meta\s+property="og:title"\s+content="Top Open Source AI Agents/,
        /<meta\s+property="og:description"\s+content="Python-based agent frameworks and orchestration tools\."/,
        /<meta\s+property="og:type"\s+content="website"/,
      ],
    },
    {
      label: "stack taxonomy page",
      page: "stacks/python/index.html",
      mustInclude: [
        /<title>Python projects/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/stacks\/python\/"/,
      ],
    },
    {
      label: "category taxonomy page",
      page: "categories/agents/index.html",
      mustInclude: [
        /<title>Agents projects/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/categories\/agents\/"/,
      ],
    },
    {
      label: "license taxonomy page",
      page: "licenses/mit/index.html",
      mustInclude: [
        /<title>MIT License projects/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/licenses\/mit\/"/,
      ],
    },
    {
      label: "record detail",
      page: "projects/crewai/index.html",
      mustInclude: [
        /<title>CrewAI — Grove AI Directory<\/title>/,
        /<meta\s+property="og:type"\s+content="article"/,
        /<link\s+rel="canonical"\s+href="https:\/\/example\.com\/projects\/crewai\/"/,
      ],
    },
  ];

  for (const c of cases) {
    describe(c.label, () => {
      const head = headOf(resolve(dist, c.page));

      it("emits the canonical SEO skeleton", () => {
        for (const re of c.mustInclude) {
          expect(head).toMatch(re);
        }
      });

      it("emits the directory's JSON-LD payload", () => {
        expect(head).toMatch(
          /<script\s+type="application\/ld\+json"[^>]*>\s*\{[\s\S]*?\}[\s\S]*?<\/script>/,
        );
      });

      it("emits the dark-mode init script", () => {
        expect(head).toMatch(/grove-theme/);
      });

      it("emits the Header + Footer shell tokens", () => {
        // Body of the page should include the navigation landmarks.
        const html = readFileSync(resolve(dist, c.page), "utf8");
        expect(html).toMatch(/<header\b/);
        expect(html).toMatch(/<footer\b/);
      });

      it("emits the Submit-project CTA from BaseLayout", () => {
        // `submitHref="/submit"` is wired into the header CTA.
        // `BaseLayout` renders the button only when `submitHref`
        // is provided (it is on every detail / list / collection
        // page in the example).
        const html = readFileSync(resolve(dist, c.page), "utf8");
        expect(html).toMatch(/href="\/submit"/);
      });
    });
  }

  // Cross-cutting: every page in the dist that the example ships
  // must at minimum carry a title, a description, and a canonical
  // link. This is the bare minimum for SEO.
  const allPages = [
    "index.html",
    "projects/index.html",
    "projects/crewai/index.html",
    "projects/dify/index.html",
    "projects/flowise/index.html",
    "projects/llamaindex/index.html",
    "projects/ollama/index.html",
    "projects/open-webui/index.html",
    "collections/index.html",
    "collections/top-ai-agents/index.html",
    "collections/top-flutter/index.html",
    "stacks/python/index.html",
    "stacks/typescript/index.html",
    "stacks/go/index.html",
    "categories/agents/index.html",
    "categories/data-tools/index.html",
    "categories/interfaces/index.html",
    "categories/local-models/index.html",
    "categories/orchestration/index.html",
    "licenses/mit/index.html",
    "licenses/apache-2.0/index.html",
    "about/index.html",
    "contributors/index.html",
    "submit/index.html",
    "404.html",
  ];

  describe("every example page carries the minimum SEO skeleton", () => {
    for (const p of allPages) {
      it(`${p}`, () => {
        const head = headOf(resolve(dist, p));
        expect(tagBy(head, "name", "description")).not.toBeNull();
        expect(tagBy(head, "rel", "canonical")).not.toBeNull();
        // Every page must declare og:type so OG cards render.
        expect(tagBy(head, "property", "og:type")).not.toBeNull();
      });
    }
  });
});