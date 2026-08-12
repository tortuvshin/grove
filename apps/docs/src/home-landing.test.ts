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

		// Imports the home layout and all 12 section components from src/components/home/
		expect(indexAstro).toContain("import Layout from '../layouts/HomeLayout.astro'");
		for (const name of [
			"Header",
			"Hero",
			"ProofBar",
			"Problem",
			"HowItWorks",
			"Health",
			"Integrations",
			"Build",
			"OpenApps",
			"Faq",
			"FinalCta",
			"Footer",
		]) {
			expect(indexAstro).toContain(
				`import ${name} from '../components/home/${name}.astro'`,
			);
		}

		// Renders every section in the flagship order: hero → proof → problem →
		// how it works → differentiator → outputs → blueprints → production
		// story → FAQ → final CTA.
		expect(indexAstro).toMatch(
			/<Header\s*\/>\s*<main id="main-content">\s*<Hero\s*\/>\s*<ProofBar\s*\/>\s*<Problem\s*\/>\s*<HowItWorks\s*\/>\s*<Health\s*\/>\s*<Integrations\s*\/>\s*<Build\s*\/>\s*<OpenApps\s*\/>\s*<Faq\s*\/>\s*<FinalCta\s*\/>\s*<\/main>\s*<Footer\s*\/>/,
		);

		// The superseded sections must stay deleted.
		for (const name of ["Features", "GetStarted", "Blueprints", "Frameworks"]) {
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

	it("ships the home stylesheet with @theme tokens instead of Starlight variables", async () => {
		const homeCss = await readFile(resolve(docsRoot, "src/styles/home.css"), "utf8");

		expect(homeCss).toMatch(/@import\s+['"]tailwindcss['"]/);
		expect(homeCss).toMatch(/@theme\s*\{/);

		// Standalone Grove tokens — "grove at night" canvas + self-hosted display serif
		expect(homeCss).toMatch(/--color-bg:\s*#0a0d0b/);
		expect(homeCss).toMatch(/--color-fg:\s*#f5f7f5/);
		expect(homeCss).toMatch(/--color-accent-green:\s*oklch\(78% 0\.19 152\)/);
		expect(homeCss).toContain("--font-sans: ui-sans-serif");
		expect(homeCss).toContain("--font-mono: ui-monospace");
		expect(homeCss).toContain("@fontsource/fraunces");
		expect(homeCss).toContain("--font-display: 'Fraunces'");

		// No Starlight tokens leak in
		expect(homeCss).not.toContain("--sl-");
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

	it("renders the canonical brand line and truthful hero artifacts", async () => {
		const hero = await readComponent("Hero");

		// H1 is the canonical brand line from vision.md, with the closing
		// phrase in a gradient span — asserted in two contiguous halves.
		expect(hero).toContain("Grow useful");
		expect(hero).toContain("community knowledge.");
		expect(hero).toContain("text-gradient");
		expect(hero).toContain(
			"Grove turns community submissions into structured, searchable, and maintainable knowledge spaces",
		);

		// Copy-paste install command + copy-to-clipboard affordance
		expect(hero).toContain("pnpm dlx @grove-dev/cli@latest init my-space");
		expect(hero).toContain('id="hero-copy-command"');
		expect(hero).toContain("navigator.clipboard.writeText");

		// The pipeline mockup shows a real record and the REAL `grove check`
		// summary line from packages/cli/src/index.ts — not invented output.
		expect(hero).toContain("data/records/crewai.yml");
		expect(hero).toContain(
			"[grove] 6 records prepared; sitemap and llms files updated.",
		);

		// Interactive treatments degrade gracefully.
		expect(hero).toContain("prefers-reduced-motion");
		expect(hero).toContain("grove-aurora");

		// Hero links point at real destinations, not placeholder "#".
		expect(hero).toContain('href="/roadmap/"');
		expect(hero).toContain('href="/getting-started/create-a-space/"');
		expect(hero).toContain('href="https://open-apps.dev.mn"');
		expect(hero).toContain('target="_blank"');
	});

	it("shows only verifiable project numbers in the proof bar", async () => {
		const proofBar = await readComponent("ProofBar");

		// These figures were verified against the repo (packages/, CLI commands
		// in packages/cli/src/index.ts, components in packages/astro/src/
		// components, the vitest unit project, Lighthouse budget in
		// packages/cli/src/audit.ts). If the codebase changes, update the
		// landing page and this test together.
		expect(proofBar).toContain("npm packages");
		expect(proofBar).toContain("CLI commands");
		expect(proofBar).toContain("Astro components");
		expect(proofBar).toContain("unit tests");
		expect(proofBar).toContain("Lighthouse CI gate");
		expect(proofBar).toContain("100×4");
		expect(proofBar).toContain("MIT");
	});

	it("frames the problem as three problem→solution pairs", async () => {
		const problem = await readComponent("Problem");

		expect(problem).toContain("Community lists rot.");
		expect(problem).toContain("Structure drifts");
		expect(problem).toContain("Metadata goes stale");
		expect(problem).toContain("Curation is unauditable");
		// Every pain is answered by a concrete Grove mechanism.
		expect(problem).toContain("grove check");
		expect(problem).toContain("grove sync github");
		expect(problem).toContain("decisions.yml");
	});

	it("walks Plant → Grow → Prune with real CLI output", async () => {
		const how = await readComponent("HowItWorks");

		// Header nav's "How it works" anchor target lives here now.
		expect(how).toContain('id="how-it-works"');
		expect(how).toContain("Plant. Grow. Prune.");

		// Real command surface…
		expect(how).toContain("pnpm dlx @grove-dev/cli@latest init my-space");
		expect(how).toContain("pnpm exec grove check");
		expect(how).toContain("pnpm exec grove sync github");
		expect(how).toContain("pnpm exec grove cleanup --strict");
		// …and the real output strings from packages/cli.
		expect(how).toContain(
			"[grove] 6 records prepared; sitemap and llms files updated.",
		);
		expect(how).toContain("[sync github] 5 updated (1 HTML fallback), 0 failed");
		expect(how).toContain(
			"[cleanup] 2 candidate(s) → data/generated/cleanup-report.json",
		);

		// The editorial-judgment boundary stays explicit.
		expect(how).toContain("editorial judgment stays human");
	});

	it("renders the derived-health section with the real classifyHealth rules and the human override layer", async () => {
		const health = await readComponent("Health");

		expect(health).toContain("Health is derived, not declared.");
		// Threshold copy must mirror classifyHealth() in packages/core/src/health.ts
		expect(health).toContain("Pushed within 183 days");
		expect(health).toContain("50 stars");
		expect(health).toContain("500 stars + maintained signals");
		// Both layers of the model: derived data and reasoned human override
		expect(health).toContain("data/health.yml");
		expect(health).toContain("decisions.yml");
		expect(health).toContain("reason:");
		expect(health).toMatch(/<section[^>]+aria-labelledby="health-title"/);
	});

	it("keeps the blueprint cards and the honest renderer matrix in the Build section", async () => {
		const build = await readComponent("Build");

		expect(build).toContain("Project directories");
		expect(build).toContain("Resource hubs");
		expect(build).toContain("Ecosystem maps");
		expect(build).toContain("Maintained awesome lists");
		expect(build).toContain("Available today");
		expect(build).toContain("Schema available");

		// Honesty framing: only Astro ships today (audit finding: the old
		// 8-logo equal-status matrix overstated support).
		expect(build).toContain("Supported today");
		expect(build).toContain("Planned V1.1");
		expect(build).toContain("--framework");
		expect(build).toMatch(/<img[^>]+alt=/);
		expect(build).toMatch(/<img[^>]+width="24"/);
		expect(build).toContain('loading="lazy"');
	});

	it("serves the renderer logo SVGs actually referenced by Build.astro", async () => {
		const logosDir = resolve(docsRoot, "public/logos");
		const expected = ["astro.svg", "svelte.svg", "nextdotjs.svg"];
		for (const name of expected) {
			expect(existsSync(resolve(logosDir, name))).toBe(true);
		}
		const build = await readComponent("Build");
		for (const name of expected) {
			expect(build).toContain(`/logos/${name}`);
		}
	});

	it("keeps the Open Apps production story and the Integrations output map", async () => {
		const openApps = await readComponent("OpenApps");
		const integrations = await readComponent("Integrations");

		expect(openApps).toContain("Grove grew out of maintaining Open Apps.");
		expect(openApps).toContain('id="open-apps"');
		expect(openApps).toContain("https://open-apps.dev.mn");

		expect(integrations).toContain("One source, multiple outputs");
		expect(integrations).toContain("llms-full.txt");
		expect(integrations).toContain("record.yml");
	});

	it("wires each section to its heading via aria-labelledby for assistive tech", async () => {
		const sectionHeader = await readComponent("SectionHeader");
		// SectionHeader owns the shared <h2 id> used by most sections.
		expect(sectionHeader).toMatch(/<h2[^>]+id=/);

		const hero = await readComponent("Hero");
		expect(hero).toMatch(/<section[^>]+aria-labelledby=/);
		expect(hero).toMatch(/<h1[^>]+id=/);

		for (const name of ["Problem", "HowItWorks", "Health", "Integrations", "Build", "OpenApps", "Faq", "FinalCta"]) {
			const src = await readComponent(name);
			expect(src, name).toMatch(/<section[^>]+aria-labelledby=/);
		}

		const finalCta = await readComponent("FinalCta");
		expect(finalCta).toContain('href="/getting-started/create-a-space/"');
		expect(finalCta).toContain('href="https://github.com/tortuvshin/grove"');
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
		expect(manifest.theme_color).toBe("#0a0d0b");
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
		expect(home).toContain('content="#0a0d0b"');
		expect(home).toContain('rel="manifest"');
		expect(home).toContain('rel="apple-touch-icon"');
		// Social alt text follows the canonical brand line.
		expect(home).toContain("Grove — Grow useful community knowledge");

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

		expect(header).toContain("#how-it-works");
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
