import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { REDIRECTS } from "./data/redirects.mjs";
import { SIDEBAR } from "./data/docs-sidebar.mjs";
import { buildDocsLlmsFullTxt, buildDocsLlmsTxt, docSlugToUrl } from "./lib/llms";

const docsRoot = resolve(import.meta.dirname, "..");

const site = {
	name: "Grove",
	url: "https://withgrove.dev",
	description: "File-first publishing for structured knowledge.",
};

/** Every slug declared anywhere in the sidebar tree, in order. */
const sidebarSlugs = (items: unknown[]): string[] =>
	items.flatMap((item) => {
		const entry = item as { slug?: string; items?: unknown[] };
		return [
			...(entry.slug ? [entry.slug] : []),
			...(entry.items ? sidebarSlugs(entry.items) : []),
		];
	});

describe("llms.txt builders", () => {
	const slugs = sidebarSlugs(SIDEBAR);
	const pages = [
		...slugs.map((slug, index) => ({
			slug,
			title: `Title ${index}`,
			description: `Description ${index}.`,
			body: `Body for ${slug}.`,
		})),
		// A page reachable only from the top nav, not the sidebar.
		{
			slug: "project/roadmap",
			title: "Roadmap",
			description: "Where Grove is heading.",
			body: "Roadmap body.",
		},
	];

	it("groups every sidebar page under its section and catches the rest in Other", () => {
		const txt = buildDocsLlmsTxt({ site, pages, sidebar: SIDEBAR });

		expect(txt.startsWith("# Grove\n\n> ")).toBe(true);
		for (const group of SIDEBAR as { label: string }[]) {
			expect(txt).toContain(`## ${group.label}`);
		}
		// Every page appears exactly once as a markdown link with its
		// description, at the page's canonical trailing-slash URL.
		for (const page of pages) {
			const line = `[${page.title}](https://withgrove.dev/${page.slug}/): ${page.description}`;
			expect(txt).toContain(line);
			expect(txt.indexOf(line)).toBe(txt.lastIndexOf(line));
		}
		// The nav-only page is not silently dropped.
		expect(txt).toContain("## Other");
		expect(txt.indexOf("## Other")).toBeGreaterThan(txt.indexOf("## Project"));
	});

	it("emits full page bodies with canonical URLs in llms-full.txt", () => {
		const full = buildDocsLlmsFullTxt({ site, pages });

		expect(full).toContain("# Grove — full documentation");
		for (const page of pages) {
			expect(full).toContain(`URL: https://withgrove.dev/${page.slug}/`);
			expect(full).toContain(page.body);
		}
		// Pages are separated by horizontal rules.
		expect(full.match(/^---$/gm)?.length).toBe(pages.length);
	});

	it("builds trailing-slash absolute URLs from collection ids", () => {
		expect(docSlugToUrl("introduction", site.url)).toBe(
			"https://withgrove.dev/introduction/",
		);
		expect(docSlugToUrl("getting-started/scaffold", site.url)).toBe(
			"https://withgrove.dev/getting-started/scaffold/",
		);
	});

	it("is served by static endpoints registered under src/pages/", () => {
		expect(existsSync(resolve(docsRoot, "src/pages/llms.txt.ts"))).toBe(true);
		expect(existsSync(resolve(docsRoot, "src/pages/llms-full.txt.ts"))).toBe(true);
	});
});

describe("redirect map", () => {
	it("holds only well-formed, chain-free internal redirects", () => {
		const entries = Object.entries(REDIRECTS) as [string, string][];
		expect(entries.length).toBeGreaterThan(0);
		for (const [from, to] of entries) {
			expect(from).toMatch(/^\/(?:[\w-]+\/)+$/);
			expect(to).toMatch(/^\/(?:[\w-]+\/)+$/);
			// No chains: a redirect target must not itself be redirected.
			expect(REDIRECTS[to as keyof typeof REDIRECTS]).toBeUndefined();
			// The Cloudflare _redirects line the build writes for this entry.
			expect(`${from} ${to} 301`).toMatch(/^\/\S+ \/\S+ 301$/);
		}
	});
});

describe("generated raster assets", () => {
	const png = async (path: string) =>
		sharp(resolve(docsRoot, "public", path)).metadata();

	it("commits the social card and icons at their advertised sizes", async () => {
		const og = await png("og-image.png");
		expect([og.width, og.height, og.format]).toEqual([1200, 630, "png"]);

		const touch = await png("apple-touch-icon.png");
		expect([touch.width, touch.height]).toEqual([180, 180]);

		expect((await png("icons/icon-192.png")).width).toBe(192);
		expect((await png("icons/icon-512.png")).width).toBe(512);
		expect((await png("icons/icon-512-maskable.png")).width).toBe(512);
	});

	it("points the home Organization logo at an asset that exists", async () => {
		const home = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);
		const match = home.match(/squareLogoUrl = new URL\('([^']+)'/);
		expect(match).not.toBeNull();
		const logoPath = match?.[1] ?? "";
		expect(existsSync(resolve(docsRoot, "public", `.${logoPath}`))).toBe(true);
		const logo = await png(`.${logoPath}`);
		// schema.org Organization.logo wants a square raster >= 112px.
		expect(logo.width).toBe(logo.height);
		expect(logo.width ?? 0).toBeGreaterThanOrEqual(112);
	});
});

describe("per-page head coverage", () => {
	it("registers the Head override with robots + article JSON-LD", async () => {
		const head = await readFile(
			resolve(docsRoot, "src/components/StarlightHead.astro"),
			"utf8",
		);
		expect(head).toContain("index,follow,max-image-preview:large");
		expect(head).toContain("noindex");
		expect(head).toContain("TechArticle");
		expect(head).toContain("BreadcrumbList");

		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");
		expect(config).toContain("Head: './src/components/StarlightHead.astro'");
		// The sitemap integration is declared explicitly so entries carry
		// lastmod from git history (Starlight would otherwise add a bare one).
		expect(config).toContain("sitemap(");
		expect(config).toContain("lastmod");
	});
});
