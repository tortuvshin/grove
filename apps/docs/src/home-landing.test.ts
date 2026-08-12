import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = resolve(import.meta.dirname, "..");

describe("docs homepage (standalone Astro route)", () => {
  it("uses a custom pages/index.astro that overrides the Starlight splash route", async () => {
    const indexAstroPath = resolve(docsRoot, "src/pages/index.astro");
    expect(existsSync(indexAstroPath)).toBe(true);

    const indexAstro = await readFile(indexAstroPath, "utf8");

    // Imports the home layout and all 12 section components from src/components/home/
    expect(indexAstro).toContain("import Layout from '../layouts/HomeLayout.astro'");
    expect(indexAstro).toContain("import Header from '../components/home/Header.astro'");
    expect(indexAstro).toContain("import Hero from '../components/home/Hero.astro'");
    expect(indexAstro).toContain("import Features from '../components/home/Features.astro'");
    expect(indexAstro).toContain("import GetStarted from '../components/home/GetStarted.astro'");
    expect(indexAstro).toContain("import Health from '../components/home/Health.astro'");
    expect(indexAstro).toContain("import Blueprints from '../components/home/Blueprints.astro'");
    expect(indexAstro).toContain("import Frameworks from '../components/home/Frameworks.astro'");
    expect(indexAstro).toContain("import Integrations from '../components/home/Integrations.astro'");
    expect(indexAstro).toContain("import OpenApps from '../components/home/OpenApps.astro'");
    expect(indexAstro).toContain("import FinalCta from '../components/home/FinalCta.astro'");
    expect(indexAstro).toContain("import Footer from '../components/home/Footer.astro'");

    // Renders every section in order
    expect(indexAstro).toMatch(/<Header\s*\/>/);
    expect(indexAstro).toMatch(/<Hero\s*\/>/);
    expect(indexAstro).toMatch(/<Features\s*\/>/);
    expect(indexAstro).toMatch(/<GetStarted\s*\/>/);
    expect(indexAstro).toMatch(/<Health\s*\/>/);
    // Health renders directly after the lifecycle section, before Integrations
    expect(indexAstro).toMatch(/<GetStarted\s*\/>\s*<Health\s*\/>\s*<Integrations\s*\/>/);
    expect(indexAstro).toMatch(/<Blueprints\s*\/>/);
    expect(indexAstro).toMatch(/<Frameworks\s*\/>/);
    expect(indexAstro).toMatch(/<Integrations\s*\/>/);
    expect(indexAstro).toMatch(/<OpenApps\s*\/>/);
    expect(indexAstro).toMatch(/<FinalCta\s*\/>/);
    expect(indexAstro).toMatch(/<Footer\s*\/>/);
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
    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );

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
    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );
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

  it("renders the canonical Grove home copy across the section components", async () => {
    const hero = await readFile(
      resolve(docsRoot, "src/components/home/Hero.astro"),
      "utf8",
    );
    const features = await readFile(
      resolve(docsRoot, "src/components/home/Features.astro"),
      "utf8",
    );
    const getStarted = await readFile(
      resolve(docsRoot, "src/components/home/GetStarted.astro"),
      "utf8",
    );
    const blueprints = await readFile(
      resolve(docsRoot, "src/components/home/Blueprints.astro"),
      "utf8",
    );
    const integrations = await readFile(
      resolve(docsRoot, "src/components/home/Integrations.astro"),
      "utf8",
    );
    const finalCta = await readFile(
      resolve(docsRoot, "src/components/home/FinalCta.astro"),
      "utf8",
    );

    // The headline is one sentence with the closing phrase wrapped in a
    // gradient span, so it is asserted in two contiguous halves.
    expect(hero).toContain("Build community knowledge that");
    expect(hero).toContain("stays useful.");
    expect(hero).toContain("pnpm dlx @grove-dev/cli@latest init my-space");
    expect(hero).toContain("data/records/crewai.yml");
    // Real `grove check` summary line (packages/cli/src/index.ts), not invented output
    expect(hero).toContain("[grove] 6 records prepared; sitemap and llms files updated.");

    expect(features).toContain("Lists are easy to start and difficult to maintain.");
    expect(features).toContain("Structure drifts");
    expect(features).toContain("Maintenance lives in memory");

    expect(getStarted).toContain("pnpm exec grove check --strict");
    expect(getStarted).toContain("pnpm exec grove sync github");
    expect(getStarted).toContain("pnpm exec grove cleanup --strict");

    expect(blueprints).toContain("Project directories");
    expect(blueprints).toContain("Resource hubs");
    expect(blueprints).toContain("Ecosystem maps");

    expect(integrations).toContain("One source, multiple outputs");
    expect(integrations).toContain("llms-full.txt");

    expect(finalCta).toContain("Start with the Astro implementation.");
  });

  it("renders the derived-health section with the real classifyHealth rules and the human override layer", async () => {
    const health = await readFile(
      resolve(docsRoot, "src/components/home/Health.astro"),
      "utf8",
    );

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

  it("shows only verifiable project numbers in the final CTA stat row", async () => {
    const finalCta = await readFile(
      resolve(docsRoot, "src/components/home/FinalCta.astro"),
      "utf8",
    );

    // These figures were verified against the repo (CLI commands in
    // packages/cli/src/index.ts, components in packages/astro/src/components,
    // vitest unit-test count, Lighthouse budget in packages/cli/src/audit.ts).
    // If the codebase changes, update the landing page and this test together.
    expect(finalCta).toContain("CLI commands");
    expect(finalCta).toContain("Astro components");
    expect(finalCta).toContain("Unit tests");
    expect(finalCta).toContain("Lighthouse CI gate");
    expect(finalCta).toContain("100×4");
  });

  it("wires each section to its heading via aria-labelledby for assistive tech", async () => {
    const hero = await readFile(
      resolve(docsRoot, "src/components/home/Hero.astro"),
      "utf8",
    );
    const features = await readFile(
      resolve(docsRoot, "src/components/home/Features.astro"),
      "utf8",
    );
    const getStarted = await readFile(
      resolve(docsRoot, "src/components/home/GetStarted.astro"),
      "utf8",
    );
    const blueprints = await readFile(
      resolve(docsRoot, "src/components/home/Blueprints.astro"),
      "utf8",
    );
    const integrations = await readFile(
      resolve(docsRoot, "src/components/home/Integrations.astro"),
      "utf8",
    );
    const finalCta = await readFile(
      resolve(docsRoot, "src/components/home/FinalCta.astro"),
      "utf8",
    );

    // Sections that delegate the heading to <SectionHeader> don't
// have an `<h2 id>` in their source — the heading lives in the
// shared component. We read SectionHeader.astro separately and
// check its h2 pattern satisfies the test once.
const sectionHeader = await readFile(
  resolve(docsRoot, "src/components/home/SectionHeader.astro"),
  "utf8",
);

for (const [name, src] of [
  ["Hero", hero],
  ["Features", features],
  ["GetStarted", getStarted],
  ["Blueprints", blueprints],
  ["Integrations", integrations],
  ["FinalCta", finalCta],
] as const) {
  expect(src, name).toMatch(/<section[^>]+aria-labelledby=/);
  // Hero uses <h1> (the page title); every other section uses <h2>.
  // Sections that delegate the heading to <SectionHeader> don't have
  // the `<h2 id>` in their own source, but they import the
  // component, which does. Either path satisfies the pattern.
  const usesSharedHeader = src.includes("SectionHeader");
  const sourceToCheck = usesSharedHeader ? sectionHeader : src;
  const headingPattern =
    name === "Hero" ? /<h1[^>]+id=/ : /<h2[^>]+id=/;
  expect(sourceToCheck, name).toMatch(headingPattern);
}

    // Hero links should point at real destinations, not placeholder "#"
    expect(hero).toContain('href="/roadmap/"');
    expect(hero).toContain('href="https://open-apps.dev.mn"');
    expect(hero).toContain('target="_blank"');
    expect(finalCta).toContain('href="/getting-started/create-a-space/"');
    expect(finalCta).toContain('href="https://github.com/tortuvshin/grove"');
  });

  it("uses honest framework logos and keyboard-operable lifecycle tabs", async () => {
    const frameworks = await readFile(
      resolve(docsRoot, "src/components/home/Frameworks.astro"),
      "utf8",
    );
    const lifecycle = await readFile(
      resolve(docsRoot, "src/components/home/GetStarted.astro"),
      "utf8",
    );

    expect(frameworks).toMatch(/<img[^>]+alt=/);
    expect(frameworks).toMatch(/<img[^>]+width="24"/);
    expect(frameworks).toMatch(/<img[^>]+height="24"/);
    expect(frameworks).toContain('loading="lazy"');
    expect(lifecycle).toContain('role="tablist"');
    expect(lifecycle).toContain('role="tab"');
    expect(lifecycle).toContain('role="tabpanel"');
    expect(lifecycle).toContain("event.key === 'ArrowDown'");
    expect(lifecycle).toContain("event.key === 'Home'");
  });

  it("serves the framework logo SVGs actually referenced by Frameworks.astro", async () => {
    // Frameworks.astro renders exactly three logos today: Astro
    // (supported), SvelteKit + Next.js (planned). The other five
    // SVGs in public/logos/ are unreferenced and not shipped in the
    // visible matrix — keep them out of the source tree entirely.
    const logosDir = resolve(docsRoot, "public/logos");
    const expected = ["astro.svg", "svelte.svg", "nextdotjs.svg"];
    for (const name of expected) {
      expect(existsSync(resolve(logosDir, name))).toBe(true);
    }
    // The Frameworks component must not silently start rendering a
    // dead asset if someone re-adds it later.
    const frameworks = await readFile(
      resolve(docsRoot, "src/components/home/Frameworks.astro"),
      "utf8",
    );
    for (const name of expected) {
      expect(frameworks).toContain(`/logos/${name}`);
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
    expect(home).toContain('url: siteUrl');
    expect(home).not.toContain("'@type': 'SearchAction'");
  });

  it("emits a global WebSite JSON-LD on every Starlight page via head config", async () => {
    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );
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
    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );

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
    const header = await readFile(
      resolve(docsRoot, "src/components/home/Header.astro"),
      "utf8",
    );

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

    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );
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

    const faq = await readFile(
      resolve(docsRoot, "src/components/home/Faq.astro"),
      "utf8",
    );
    // The FAQ list is generated by `.map(FAQ_ITEMS)`; assert that the
    // component wires through the shared module so JSON-LD cannot drift.
    expect(faq).toContain("from '../../data/faq.ts'");
    expect(faq).toMatch(/faqs\.map/);

    const faqData = await readFile(
      resolve(docsRoot, "src/data/faq.ts"),
      "utf8",
    );
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
    const header = await readFile(
      resolve(docsRoot, "src/components/home/Header.astro"),
      "utf8",
    );

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
