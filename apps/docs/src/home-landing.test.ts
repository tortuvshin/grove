import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = resolve(import.meta.dirname, "..");

const readComponent = (name: string) =>
	readFile(resolve(docsRoot, `src/components/home/${name}.astro`), "utf8");

describe("docs homepage (standalone Astro route)", () => {
	it("uses a custom pages/index.astro that overrides the Starlight splash route", async () => {
		const indexAstroPath = resolve(docsRoot, "src/pages/index.astro");
		expect(existsSync(indexAstroPath)).toBe(true);

		const indexAstro = await readFile(indexAstroPath, "utf8");

		// Imports the home layout and all 10 section components from src/components/home/
		expect(indexAstro).toContain("import Layout from '../layouts/HomeLayout.astro'");
		for (const name of [
			"Header",
			"Hero",
			"ProofBar",
			"Features",
			"Demo",
			"OpenApps",
			"Faq",
			"FinalCta",
			"Footer",
		]) {
			expect(indexAstro).toContain(
				`import ${name} from '../components/home/${name}.astro'`,
			);
		}

		// Renders every section in the vite.dev-style order: hero → proof bar →
		// feature grid → live demo → production story → FAQ → gradient CTA band.
		expect(indexAstro).toMatch(
			/<Header\s*\/>\s*<main id="main-content">\s*<Hero\s*\/>\s*<ProofBar\s*\/>\s*<Features\s*\/>\s*<Demo\s*\/>\s*<OpenApps\s*\/>\s*<Faq\s*\/>\s*<FinalCta\s*\/>\s*<\/main>\s*<Footer\s*\/>/,
		);

		// Superseded sections from earlier iterations must stay deleted.
		for (const name of [
			"GetStarted",
			"Blueprints",
			"Frameworks",
			"Problem",
			"HowItWorks",
			"Health",
			"WhyGrove",
			"Decay",
			"Lifecycle",
			"Discovery",
			"Records",
			"Integrations",
			"Build",
		]) {
			expect(
				existsSync(resolve(docsRoot, `src/components/home/${name}.astro`)),
				name,
			).toBe(false);
		}
	});

	it("uses a standalone HomeLayout (not BaseLayout) and only Tailwind on the body", async () => {
		const layoutSource = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);

		// Pulls in only the standalone stylesheet — no Starlight tokens
		// (the home uses components/home/Header.astro, which is Tailwind-only).
		expect(layoutSource).toContain("import '../styles/home.css'");
		expect(layoutSource).not.toContain("import '../styles/global.css'");
		expect(layoutSource).not.toContain("Sidebar");
		expect(layoutSource).not.toContain("--sl-color");
		expect(layoutSource).not.toContain("--sl-font");
		expect(layoutSource).not.toContain("var(--sl-");

		// Tailwind classes on body for the standalone theme
		expect(layoutSource).toMatch(/class="min-h-screen bg-bg text-fg antialiased"/);
	});

	it("ships the home stylesheet with the vite.dev-style palette and no webfonts", async () => {
		const homeCss = await readFile(resolve(docsRoot, "src/styles/home.css"), "utf8");

		expect(homeCss).toMatch(/@import\s+['"]tailwindcss['"]/);
		expect(homeCss).toMatch(/@theme\s*\{/);

		// Neutral dark canvas + indigo brand + cyan→purple signature gradient.
		expect(homeCss).toMatch(/--color-bg:\s*#101010/);
		expect(homeCss).toMatch(/--color-fg:\s*#f6f6f7/);
		expect(homeCss).toMatch(/--color-brand:\s*#646cff/);
		expect(homeCss).toMatch(/--color-accent-cyan:\s*#41d1ff/);
		expect(homeCss).toMatch(/--color-accent-purple:\s*#bd34fe/);
		expect(homeCss).toContain("linear-gradient(120deg, #41d1ff 10%, #bd34fe)");

		// Same font story as the docs (Starlight defaults): the system stack,
		// no webfont imports.
		expect(homeCss).toContain("--font-sans: ui-sans-serif");
		expect(homeCss).toContain("--font-mono: ui-monospace");
		expect(homeCss).not.toMatch(/@fontsource|fraunces|@font-face/i);

		// No Starlight tokens leak in
		expect(homeCss).not.toContain("--sl-");
	});

	it("keeps the webfont out of the docs package dependencies", async () => {
		const pkg = await readFile(resolve(docsRoot, "package.json"), "utf8");
		expect(pkg).not.toContain("@fontsource/fraunces");
	});

	it("wires @tailwindcss/vite into astro.config.mjs alongside Starlight", async () => {
		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");

		expect(config).toContain("import tailwindcss from '@tailwindcss/vite'");
		expect(config).toMatch(/vite:\s*\{[\s\S]*plugins:\s*\[tailwindcss\(\)\]/);

		// Starlight integration still present (other docs pages need it)
		expect(config).toContain("starlight({");
		expect(config).toContain("import grove from '@grove-dev/starlight'");
	});

	it("removes the Starlight splash content/docs/index.mdx so the custom route owns /", async () => {
		const splashPath = resolve(docsRoot, "src/content/docs/index.mdx");
		expect(existsSync(splashPath)).toBe(false);
	});

	it("uses grove.dev.mn as the canonical site URL everywhere it appears", async () => {
		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");
		expect(config).toContain("site: 'https://grove.dev.mn'");
		expect(config).not.toMatch(/site:\s*['"]https:\/\/grove\.dev['"]/);
		expect(config).not.toMatch(/grove\.tortuvshin\.dev/);

		const release = await readFile(
			resolve(docsRoot, "src/content/docs/maintainers/release-process.md"),
			"utf8",
		);
		expect(release).toContain("grove.dev.mn");
		expect(release).not.toContain("to grove.dev)");

		const homeLayout = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);
		expect(homeLayout).toContain("https://grove.dev.mn");
		expect(homeLayout).not.toContain("https://grove.dev'");
	});

	it("renders a centered, plain-language hero with the glowing mark and pill buttons", async () => {
		const hero = await readComponent("Hero");

		// Positioning line, closing phrase in the signature gradient.
		expect(hero).toContain("Build directories");
		expect(hero).toContain("that stay useful.");
		expect(hero).toContain("text-gradient");

		// The paragraph explains the product in user terms, not CLI terms.
		expect(hero).toContain(
			"open-source framework for curated directories, resource hubs, and knowledge sites",
		);

		// vite.dev-style hero: no terminals or install commands here.
		expect(hero).not.toContain("pnpm dlx");
		expect(hero).not.toContain("<pre");

		// Buttons point at real destinations.
		expect(hero).toContain('href="/getting-started/create-a-space/"');
		expect(hero).toContain('href="/introduction/"');
		expect(hero).toContain('href="https://github.com/tortuvshin/grove"');
		expect(hero).toContain('target="_blank"');
		expect(hero).toContain('href="/roadmap/"');

		// Glowing floating mark + beam field degrade gracefully.
		expect(hero).toContain("hero-beams");
		expect(hero).toContain("hero-mark-glow");
		expect(hero).toContain("prefers-reduced-motion");

		// Honesty strip.
		expect(hero).toContain("No database · No CMS · MIT licensed");
	});

	it("shows only verifiable project numbers in the proof bar", async () => {
		const proofBar = await readComponent("ProofBar");

		// These figures were verified against the repo (packages/, CLI commands
		// in packages/cli/src/index.ts, components in packages/astro/src/
		// components, the vitest unit project, Lighthouse budget in
		// packages/cli/src/audit.ts). If the codebase changes, update the
		// landing page and this test together.
		expect(proofBar).toContain("Built in the open");
		expect(proofBar).toContain("npm packages");
		expect(proofBar).toContain("CLI commands");
		expect(proofBar).toContain("Astro components");
		expect(proofBar).toContain("unit tests");
		expect(proofBar).toContain("Lighthouse CI gate");
		expect(proofBar).toContain("100×4");
		expect(proofBar).toContain("MIT");
	});

	it("explains the product with an eight-card, plain-language feature grid", async () => {
		const features = await readComponent("Features");

		expect(features).toContain('id="features"');
		expect(features).toContain("Redefining");
		expect(features).toContain("directory maintenance.");

		// Eight benefit-first cards; each maps to shipped behavior.
		for (const title of [
			"Ready in a minute",
			"Search & lenses",
			"Curated collections",
			"Rich detail pages",
			"Self-updating metadata",
			"Stays healthy",
			"One source, many outputs",
			"Yours to own",
		]) {
			expect(features, title).toContain(title);
		}

		// User-language claims that map to real mechanisms.
		expect(features).toContain("review queue");
		expect(features).toContain("llms.txt");
		expect(features).toContain("No database, no CMS");

		// No terminal output in the feature grid — it speaks user, not CLI.
		expect(features).not.toContain("<pre");
	});

	it("tells the How Grove works story as a scroll scrub that ends in the live demo", async () => {
		const demo = await readComponent("Demo");

		expect(demo).toContain('id="demo"');
		expect(demo).toContain("How Grove works");
		expect(demo).toContain("living directory.");

		// Six-step narrative ported from the transformation concept.
		for (const label of [
			"Initialize",
			"Add content",
			"Structure",
			"Publish",
			"Generate",
			"Maintain",
		]) {
			expect(demo, label).toContain(label);
		}

		// Scene 1 types the real CLI command; scene 2 mirrors the real
		// `grove init` scaffold (packages/cli/src/init.ts copies apps/example).
		expect(demo).toContain("grove init my-space");
		for (const path of ["data/", "records/", "collections/", "taxonomy/", "grove.config.ts"]) {
			expect(demo, path).toContain(path);
		}

		// Scenes 5–6 stay truthful: generated files come from
		// GENERATED_PUBLIC_NAMES and staleness uses the 183-day threshold.
		expect(demo).toContain("Generated outputs");
		expect(demo).toContain("llms.txt");
		expect(demo).toContain("sitemap.xml");
		expect(demo).toContain("Collection health");
		expect(demo).toContain("183");

		// The scrub is a progressive enhancement only: it gates on viewport
		// width and reduced motion, and tears down cleanly.
		expect(demo).toContain('id="hgw"');
		expect(demo).toContain("prefers-reduced-motion");
		expect(demo).toContain("min-width: 1024px");
	});

	it("ships a live, filterable directory demo wired to the real lens definitions", async () => {
		const demo = await readComponent("Demo");

		expect(demo).toContain('id="demo-directory"');
		expect(demo).toContain('id="demo-directory-search"');

		// Lens labels are the real PRIMARY_LENSES from
		// packages/core/src/directory-lenses.ts, and each tab writes the same
		// URL params as toParams().
		for (const label of ["All items", "Trending", "Established", "Production-like", "Good to learn"]) {
			expect(demo, label).toContain(label);
		}
		expect(demo).toContain("label=hot");
		expect(demo).toContain("label=mature");
		expect(demo).toContain("lens=production-like");
		expect(demo).toContain("lens=good-to-learn");
		expect(demo).toContain("data-lenses");
		expect(demo).toContain('aria-live="polite"');
	});

	it("keeps the Open Apps production story", async () => {
		const openApps = await readComponent("OpenApps");

		expect(openApps).toContain("Grove grew out of maintaining Open Apps.");
		expect(openApps).toContain('id="open-apps"');
		expect(openApps).toContain("https://open-apps.dev.mn");
	});

	it("closes with a full-bleed gradient CTA band", async () => {
		const finalCta = await readComponent("FinalCta");

		expect(finalCta).toContain("Start growing with Grove.");
		expect(finalCta).toContain("cta-gradient");
		expect(finalCta).toContain('href="/getting-started/create-a-space/"');
		expect(finalCta).toContain('href="https://github.com/tortuvshin/grove"');
		expect(finalCta).toContain("pnpm dlx @grove-dev/cli@latest init my-space");
	});

	it("wires each section to its heading via aria-labelledby for assistive tech", async () => {
		// Both shared heading components own an identifiable <h2 id>.
		const sectionHeader = await readComponent("SectionHeader");
		expect(sectionHeader).toMatch(/<h2[^>]+id=/);
		const statement = await readComponent("Statement");
		expect(statement).toMatch(/<h2[^>]+id=/);

		const hero = await readComponent("Hero");
		expect(hero).toMatch(/<section[^>]+aria-labelledby=/);
		expect(hero).toMatch(/<h1[^>]+id=/);

		for (const name of ["Features", "Demo", "OpenApps", "Faq", "FinalCta"]) {
			const src = await readComponent(name);
			expect(src, name).toMatch(/<section[^>]+aria-labelledby=/);
		}
	});

	it("exposes robots.txt, an OG image, and a PWA manifest under public/", async () => {
		const robots = await readFile(resolve(docsRoot, "public/robots.txt"), "utf8");
		expect(robots).toMatch(/^User-agent:\s*\*/m);
		expect(robots).toMatch(/^Allow:\s*\//m);
		expect(robots).toContain("https://grove.dev.mn/sitemap-index.xml");

		const manifest = JSON.parse(
			await readFile(resolve(docsRoot, "public/manifest.json"), "utf8"),
		);
		expect(manifest.name).toBe("Grove");
		expect(manifest.start_url).toBe("/");
		expect(manifest.theme_color).toBe("#101010");
		expect(manifest.icons?.[0]?.src).toBe("/favicon.svg");

		expect(existsSync(resolve(docsRoot, "public/og-image.svg"))).toBe(true);
		expect(existsSync(resolve(docsRoot, "public/_headers"))).toBe(true);
	});

	it("emits WebSite + SoftwareApplication + Organization JSON-LD on the home layout", async () => {
		const home = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);
		expect(home).toContain("'@type': 'WebSite'");
		expect(home).toContain("'@type': 'SoftwareApplication'");
		expect(home).toContain("'@type': 'Organization'");
		expect(home).toContain("'@context': 'https://schema.org'");
		// All schemas reference the canonical site URL through the `siteUrl`
		// helper. The literal fallback is asserted once; the rest are
		// computed at build time from Astro.site.
		expect(home).toContain("https://grove.dev.mn");
		expect(home).toContain("url: siteUrl");
		expect(home).not.toContain("'@type': 'SearchAction'");
	});

	it("emits a global WebSite JSON-LD on every Starlight page via head config", async () => {
		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");
		expect(config).toMatch(/head:\s*\[/);
		expect(config).toContain("'@type': 'WebSite'");
		expect(config).toContain("'@context': 'https://schema.org'");
		expect(config).not.toContain("'@type': 'SearchAction'");
		expect(config).toContain("'application/ld+json'");
	});

	it("sets OG + Twitter + theme metadata on the home and Starlight head config", async () => {
		const home = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);
		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");

		// Home layout writes the tags as literal HTML.
		expect(home).toContain('property="og:image"');
		expect(home).toContain('property="og:image:width"');
		expect(home).toContain('property="og:image:height"');
		expect(home).toContain('property="og:image:alt"');
		expect(home).toContain('name="twitter:card"');
		expect(home).toContain('content="summary_large_image"');
		expect(home).toContain('name="theme-color"');
		expect(home).toContain('content="#101010"');
		expect(home).toContain('rel="manifest"');
		expect(home).toContain('rel="apple-touch-icon"');
		// Social alt text follows the positioning brand line.
		expect(home).toContain("Grove — Build curated directories that stay useful");

		// Starlight head config wires the same metadata via object literals so
		// Starlight content pages render the same preview cards. We only assert
		// the keys we added ourselves — Starlight already emits og:title /
		// og:type / twitter:card on its own, so duplicates would be noise.
		expect(config).toContain("property: 'og:image'");
		expect(config).toContain("name: 'twitter:image'");
		expect(config).toContain("property: 'og:image:width'");
		expect(config).toContain("property: 'og:image:height'");
		expect(config).toContain("property: 'og:image:alt'");
		expect(config).toContain("name: 'twitter:image:alt'");
		expect(config).toContain("name: 'theme-color'");
		expect(config).toContain("content: '#08090a'");
		expect(config).toContain("rel: 'manifest'");
		expect(config).toContain("rel: 'apple-touch-icon'");
	});

	it("serves focused navigation with a mobile menu", async () => {
		const header = await readComponent("Header");

		expect(header).toContain("#features");
		expect(header).toContain("#demo");
		expect(header).toContain("#open-apps");
		expect(header).toContain("/introduction/");
		expect(header).toContain("/roadmap/");
		expect(header).toContain("/getting-started/create-a-space/");

		// GitHub icon links to the project repo, opens in a new tab
		expect(header).toContain("https://github.com/tortuvshin/grove");
		expect(header).toContain('target="_blank"');
		expect(header).toContain('rel="noopener noreferrer"');

		// Removed UI: Search input + theme toggle button
		expect(header).not.toMatch(/Search\b/);
		expect(header).not.toContain("⌘ K");
		expect(header).not.toContain('aria-label="Toggle theme"');
		expect(header).toContain('aria-label="Open navigation menu"');
	});

	it("hosts the introduction page at /introduction/ with the Getting Started sidebar trimmed", async () => {
		// The intro file moved out of getting-started/ so it renders at the root.
		expect(existsSync(resolve(docsRoot, "src/content/docs/introduction.md"))).toBe(true);
		expect(
			existsSync(resolve(docsRoot, "src/content/docs/getting-started/introduction.md")),
		).toBe(false);

		const config = await readFile(resolve(docsRoot, "astro.config.mjs"), "utf8");
		// Intro was removed from the Getting Started sidebar (now 3 items)
		expect(config).not.toContain("slug: 'getting-started/introduction'");
		// The Grove plugin's Docs link points at the new root route
		expect(config).toContain("link: '/introduction/'");
	});

	it("mounts the FAQ section, the shared FAQ data module, and the FAQPage JSON-LD", async () => {
		const indexAstro = await readFile(
			resolve(docsRoot, "src/pages/index.astro"),
			"utf8",
		);
		expect(indexAstro).toContain("import Faq from '../components/home/Faq.astro'");
		expect(indexAstro).toMatch(/<Faq\s*\/>/);

		const faq = await readComponent("Faq");
		// The FAQ list is generated by `.map(FAQ_ITEMS)`; assert that the
		// component wires through the shared module so JSON-LD cannot drift.
		expect(faq).toContain("from '../../data/faq.ts'");
		expect(faq).toMatch(/faqs\.map/);

		const faqData = await readFile(resolve(docsRoot, "src/data/faq.ts"), "utf8");
		// Six Q&A pairs in the shared module.
		const itemCount = (faqData.match(/\bq:\s*['"]/g) ?? []).length;
		expect(itemCount).toBe(6);

		const homeLayout = await readFile(
			resolve(docsRoot, "src/layouts/HomeLayout.astro"),
			"utf8",
		);
		// FAQPage schema.org block is emitted, sourced from the same module.
		expect(homeLayout).toContain("'@type': 'FAQPage'");
		expect(homeLayout).toContain("from '../data/faq.ts'");
	});

	it("wires the mobile menu button with aria-expanded, aria-controls, Escape, and click-outside", async () => {
		const header = await readComponent("Header");

		expect(header).toContain('id="mobile-nav-toggle"');
		expect(header).toContain('id="mobile-nav-panel"');
		expect(header).toContain('aria-controls="mobile-nav-panel"');
		expect(header).toContain('aria-expanded="false"');
		expect(header).toContain('aria-label="Open navigation menu"');

		// Script-level behaviours — these all need to be present for a
		// real keyboard/screen-reader user to operate the menu.
		expect(header).toContain("e.key === 'Escape'");
		expect(header).toContain("toggle.focus()");
		expect(header).toContain("panel.hidden");
	});
});
