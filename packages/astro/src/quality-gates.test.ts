/**
 * Quality gates — crawl the example's built HTML (`apps/example/dist`)
 * and assert the audit's structural acceptance criteria hold on the
 * REAL output, not just component source:
 *
 *  - exactly one <h1> per route;
 *  - every count surface (homepage grid, /stacks, browse facet spans)
 *    agrees with the canonical count algorithm (`buildFacets` /
 *    `projectStackIds`) computed from the same generated data;
 *  - filter-group order equals the `browse.facets` config order;
 *  - taxonomy YAML display names surface verbatim in the filter UI;
 *  - the dark landing surface `#141516` never leaks into HTML and
 *    exists exactly once in the CSS (the dark `surface-raised` value);
 *  - `/empty` renders a real EmptyState, not a normal-looking gap.
 *
 * Requires a prior `pnpm build` (same convention as page-parity).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FACET_DEFS, buildFacets, projectStackIds } from "@grove-dev/core";
import type { FacetId } from "@grove-dev/core";

const root = resolve(import.meta.dirname, "../../..");
const example = resolve(root, "apps/example");
const dist = resolve(example, "dist");

/**
 * Every rendered page a visitor or a crawler can land on.
 *
 * Machine surfaces are excluded by their own `noindex` — the browse
 * page's card source (`/{slug}/page/cards/`) is a fragment the client
 * fetches, with no shell, no heading, and nothing to index. Anything
 * that opts out of the index also opts out of the page gates below.
 */
function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_astro") continue;
      out.push(...htmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      if (/name="robots"[^>]*content="[^"]*noindex/.test(readFileSync(full, "utf8"))) continue;
      out.push(full);
    }
  }
  return out;
}

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

const records = JSON.parse(
  readFileSync(resolve(example, "data/generated/records.index.json"), "utf8"),
) as { records: Array<Record<string, unknown>> };
const siteConfig = JSON.parse(
  readFileSync(resolve(example, "data/generated/site-config.json"), "utf8"),
) as {
  browse?: { facets?: string[] };
  taxonomy?: Record<string, Array<{ id: string; name: string }>>;
  blueprintConfig?: { labelSingular?: string; labelPlural?: string };
};

describe.skipIf(!existsSync(dist))("built-output quality gates", () => {
  it("renders exactly one h1 on every route", () => {
    for (const file of htmlFiles(dist)) {
      const count = readFileSync(file, "utf8").match(/<h1[\s>]/g)?.length ?? 0;
      expect(count, file.replace(dist, "")).toBe(1);
    }
  });

  it("keeps every count surface on the canonical algorithm", () => {
    const items = records.records as Parameters<typeof buildFacets>[0];
    // Canonical: visible index + primary/supporting union.
    const expected = new Map<string, number>();
    for (const record of items) {
      if (record.kind !== "project") continue;
      for (const id of projectStackIds(record)) {
        expected.set(id, (expected.get(id) ?? 0) + 1);
      }
    }
    // buildFacets must agree with the direct union count.
    const facets = buildFacets(items);
    for (const option of facets.stacks) {
      expect(expected.get(option.value), option.value).toBe(option.count);
    }

    const singular = siteConfig.blueprintConfig?.labelSingular ?? "project";
    const plural = siteConfig.blueprintConfig?.labelPlural ?? "projects";
    const stackNames = new Map(
      (siteConfig.taxonomy?.stacks ?? []).map((entry) => [entry.id, entry.name]),
    );
    // Homepage grid and /stacks index show "Name · N noun" per stack.
    for (const page of ["index.html", "stacks/index.html"]) {
      const text = textOf(readFileSync(join(dist, page), "utf8"));
      for (const [id, count] of expected) {
        const name = stackNames.get(id) ?? id;
        const label = `${name} ${count} ${count === 1 ? singular : plural}`;
        expect(text, `${page}: ${label}`).toContain(label);
      }
    }

    // Browse facet count spans carry data attributes for the client;
    // the server-rendered numbers must match the canonical counts.
    const browse = readFileSync(join(dist, "projects/index.html"), "utf8");
    const spanRe = /data-facet="stacks"[^>]*data-value="([^"]+)"[^>]*>\s*(\d+)\s*</g;
    let matched = 0;
    for (const match of browse.matchAll(spanRe)) {
      matched += 1;
      expect(expected.get(match[1]), `facet span ${match[1]}`).toBe(Number(match[2]));
    }
    expect(matched).toBeGreaterThan(0);
  });

  it("renders filter groups in browse.facets config order", () => {
    const configured = (siteConfig.browse?.facets ?? []) as FacetId[];
    expect(configured.length).toBeGreaterThan(0);
    const expectedOrder = configured.map((id) => FACET_DEFS[id].dimension);
    const browse = readFileSync(join(dist, "projects/index.html"), "utf8");
    const rendered = [...browse.matchAll(/filter-popover-([a-z]+)/g)]
      .map((match) => match[1])
      .filter((value, index, all) => all.indexOf(value) === index);
    expect(rendered).toEqual(expectedOrder.filter((dim) => rendered.includes(dim)));
    // Every configured dimension with options must render.
    for (const dim of expectedOrder) {
      expect(rendered, dim).toContain(dim);
    }
  });

  it("surfaces taxonomy YAML display names in the filter UI", () => {
    const browse = readFileSync(join(dist, "projects/index.html"), "utf8");
    for (const kind of ["stacks", "licenses", "topics"] as const) {
      for (const entry of siteConfig.taxonomy?.[kind] ?? []) {
        expect(browse, `${kind}:${entry.id}`).toContain(entry.name);
      }
    }
  });

  it("never leaks the dark landing surface into markup", () => {
    for (const file of htmlFiles(dist)) {
      expect(readFileSync(file, "utf8"), file).not.toContain("#141516");
    }
    const astroDir = join(dist, "_astro");
    const cssFiles = readdirSync(astroDir).filter((name) => name.endsWith(".css"));
    const occurrences = cssFiles
      .map((name) => readFileSync(join(astroDir, name), "utf8").match(/#141516/g)?.length ?? 0)
      .reduce((sum, count) => sum + count, 0);
    expect(occurrences).toBe(1);
  });

  it("renders /empty as an explicit EmptyState", () => {
    const empty = readFileSync(join(dist, "empty/index.html"), "utf8");
    expect(empty).toContain("data-grove-empty-state");
  });

  it("points every icon reference at a file that shipped", () => {
    // The end-to-end "no invisible icon" gate. A masked `<span>` has no
    // `onerror`, so a URL with no file behind it renders as a silent
    // blank — this is the assertion that would have caught the
    // inverted Apple pair.
    let checked = 0;
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, "utf8");
      const referenced = [
        ...html.matchAll(/--grove-icon-url:\s*url\('([^']+)'\)/g),
        ...html.matchAll(/<img[^>]+src="(\/icons\/[^"]+)"/g),
      ].map((match) => match[1]);
      for (const url of referenced) {
        expect(existsSync(join(dist, url)), `${file} → ${url}`).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("frames every route at the one configured container width", () => {
    // The shell and the page frames drifted apart once: the header and
    // footer sat at a hardcoded 1400px, record pages at 1240px, and the
    // rest followed `theme.containerWidth`. A site with a configured
    // container then had its header overhang its own body. Page frames
    // are `max-w-container`; `wide` and hardcoded pixel frames are not
    // page frames.
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, "utf8");
      // `mx-auto w-full max-w-*` is the frame convention. A centered
      // measure (`mx-auto max-w-xl` on a paragraph) is not a frame.
      const frames = [
        ...html.matchAll(/mx-auto[^"]*?\bw-full\b[^"]*?\bmax-w-(\S+?)[\s"]/g),
      ].map((match) => match[1]);
      for (const frame of frames) {
        expect(["container", "narrow"], `${file} → max-w-${frame}`).toContain(
          frame,
        );
      }
      expect(frames.length, file).toBeGreaterThan(0);
    }
  });

  it("paginates the browse route into real, crawlable pages", () => {
    // The browse page renders one page of records, not the whole
    // directory: pages 2..n are their own documents so a large
    // directory is reachable without JavaScript and by a crawler.
    const records = JSON.parse(
      readFileSync(join(dist, "projects/page/records.json"), "utf8"),
    ) as unknown[];
    const pageCount = Math.max(1, Math.ceil(records.length / 20));
    const browse = readFileSync(join(dist, "projects/index.html"), "utf8");
    const cardsOnPage = (browse.match(/<li class="m-0 p-0" data-record-slug=/g) ?? []).length;
    expect(cardsOnPage).toBe(Math.min(20, records.length));

    for (let page = 2; page <= pageCount; page += 1) {
      expect(existsSync(join(dist, `projects/page/${page}/index.html`)), `page ${page}`).toBe(true);
    }
    // …and no page beyond the last one.
    expect(existsSync(join(dist, `projects/page/${pageCount + 1}/index.html`))).toBe(false);
  });

  it("serves one card source the client can filter against", () => {
    // Filtering happens on the client and can surface any record, so
    // the cards it needs come from a page rendered by the same
    // component — never from card markup rebuilt in JavaScript.
    const records = JSON.parse(
      readFileSync(join(dist, "projects/page/records.json"), "utf8"),
    ) as { slug: string }[];
    const cards = readFileSync(join(dist, "projects/page/cards/index.html"), "utf8");
    expect(cards).toContain('id="grove-index-cards"');
    for (const record of records) {
      expect(cards, record.slug).toContain(`data-record-slug="${record.slug}"`);
    }
  });

  it("ships no theme-swap leftovers in built markup", () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, "utf8");
      expect(html, file).not.toContain("data-grove-icon-light");
      expect(html, file).not.toContain("data-grove-icon-dark");
    }
  });
});
