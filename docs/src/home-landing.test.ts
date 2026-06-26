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

    // Imports the home layout and all 9 section components from src/components/home/
    expect(indexAstro).toContain("import Layout from '../layouts/HomeLayout.astro'");
    expect(indexAstro).toContain("import Header from '../components/home/Header.astro'");
    expect(indexAstro).toContain("import Hero from '../components/home/Hero.astro'");
    expect(indexAstro).toContain("import Features from '../components/home/Features.astro'");
    expect(indexAstro).toContain("import GetStarted from '../components/home/GetStarted.astro'");
    expect(indexAstro).toContain("import Blueprints from '../components/home/Blueprints.astro'");
    expect(indexAstro).toContain("import Frameworks from '../components/home/Frameworks.astro'");
    expect(indexAstro).toContain("import Integrations from '../components/home/Integrations.astro'");
    expect(indexAstro).toContain("import FinalCta from '../components/home/FinalCta.astro'");
    expect(indexAstro).toContain("import Footer from '../components/home/Footer.astro'");

    // Renders every section in order
    expect(indexAstro).toMatch(/<Header\s*\/>/);
    expect(indexAstro).toMatch(/<Hero\s*\/>/);
    expect(indexAstro).toMatch(/<Features\s*\/>/);
    expect(indexAstro).toMatch(/<GetStarted\s*\/>/);
    expect(indexAstro).toMatch(/<Blueprints\s*\/>/);
    expect(indexAstro).toMatch(/<Frameworks\s*\/>/);
    expect(indexAstro).toMatch(/<Integrations\s*\/>/);
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

    // Standalone Grove tokens — dark canvas + Geist typography
    expect(homeCss).toMatch(/--color-bg:\s*#08090a/);
    expect(homeCss).toMatch(/--color-fg:\s*#ffffff/);
    expect(homeCss).toMatch(/--font-sans:\s*['"]Geist['"]/);
    expect(homeCss).toMatch(/--font-mono:\s*['"]Geist Mono['"]/);

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
    expect(config).toContain("import lucode from '@grove-dev/starlight'");
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

    expect(hero).toContain("The framework for community knowledge");
    expect(hero).toContain("npx @grove-dev/cli@latest new my-space");

    expect(features).toContain("File-based records");
    expect(features).toContain("GitHub-native workflows");
    expect(features).toContain("Static publishing");

    expect(getStarted).toContain("grove new");
    expect(getStarted).toContain("grove build");
    expect(getStarted).toContain("grove deploy");

    expect(blueprints).toContain("Awesome List");
    expect(blueprints).toContain("Docs Space");
    expect(blueprints).toContain("Community Wiki");
    expect(blueprints).toContain("Dataset Catalog");

    expect(integrations).toContain("/logos/astro.svg");
    expect(integrations).toContain("/logos/svelte.svg");
    expect(integrations).toContain("Integrate with your favorite tools");

    expect(finalCta).toContain("Build your knowledge space today.");
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

    for (const [name, src] of [
      ["Hero", hero],
      ["Features", features],
      ["GetStarted", getStarted],
      ["Blueprints", blueprints],
      ["Integrations", integrations],
      ["FinalCta", finalCta],
    ] as const) {
      // Integrations wraps its section in a <div> (orbital diagram lives
      // outside the heading landmark); every other component uses <section>.
      const landmarkPattern =
        name === "Integrations"
          ? /<div[^>]+aria-labelledby=/
          : /<section[^>]+aria-labelledby=/;
      expect(src, name).toMatch(landmarkPattern);
      // Hero uses <h1> (the page title); every other section uses <h2>.
      const headingPattern =
        name === "Hero" ? /<h1[^>]+id=/ : /<h2[^>]+id=/;
      expect(src, name).toMatch(headingPattern);
    }

    // Hero links should point at real destinations, not placeholder "#"
    expect(hero).toContain('href="/introduction/"');
    expect(hero).toContain('href="https://github.com/tortuvshin/grove"');
    expect(hero).toContain('target="_blank"');
    expect(finalCta).toContain('href="/introduction/"');
    expect(finalCta).toContain('href="https://github.com/tortuvshin/grove"');
  });

  it("marks decorative <img> tags with empty alt and gives every visible image dimensions", async () => {
    const frameworks = await readFile(
      resolve(docsRoot, "src/components/home/Frameworks.astro"),
      "utf8",
    );
    const integrations = await readFile(
      resolve(docsRoot, "src/components/home/Integrations.astro"),
      "utf8",
    );

    // Frameworks: each logo is meaningful — alt + dimensions + lazy
    expect(frameworks).toMatch(/<img[^>]+alt=/);
    expect(frameworks).toMatch(/<img[^>]+width="28"/);
    expect(frameworks).toMatch(/<img[^>]+height="28"/);
    expect(frameworks).toContain('loading="lazy"');

    // Integrations: orbital logos are decorative (the h2 carries meaning)
    expect(integrations).toMatch(/<img[^>]+alt=""/);
    expect(integrations).toMatch(/<img[^>]+width="48"/);
    expect(integrations).toMatch(/<img[^>]+height="48"/);
  });

  it("serves the 8 framework logo SVGs from docs/public/logos/", async () => {
    const logosDir = resolve(docsRoot, "public/logos");
    const expected = [
      "astro.svg",
      "react.svg",
      "svelte.svg",
      "vuedotjs.svg",
      "nextdotjs.svg",
      "nodedotjs.svg",
      "tailwindcss.svg",
      "github.svg",
    ];
    for (const name of expected) {
      expect(existsSync(resolve(logosDir, name))).toBe(true);
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
    expect(manifest.theme_color).toBe("#08090a");
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
    expect(home).toContain('target: `${siteUrl}');
  });

  it("emits a global WebSite JSON-LD on every Starlight page via head config", async () => {
    const config = await readFile(
      resolve(docsRoot, "astro.config.mjs"),
      "utf8",
    );
    expect(config).toMatch(/head:\s*\[/);
    expect(config).toContain("'@type': 'WebSite'");
    expect(config).toContain("'@context': 'https://schema.org'");
    expect(config).toContain("'@type': 'SearchAction'");
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
    expect(home).toContain('content="#08090a"');
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

  it("serves the home Header nav as Demo · Docs · Open Apps · Roadmap with no search or theme toggle", async () => {
    const header = await readFile(
      resolve(docsRoot, "src/components/home/Header.astro"),
      "utf8",
    );

    // Canonical nav order with the Demo entry first
    expect(header).toContain("https://open-apps.dev.mn");
    expect(header).toContain("/introduction/");
    expect(header).toContain("/open-apps/");
    expect(header).toContain("/roadmap");

    // GitHub icon links to the project repo, opens in a new tab
    expect(header).toContain("https://github.com/tortuvshin/grove");
    expect(header).toContain('target="_blank"');
    expect(header).toContain('rel="noopener noreferrer"');

    // Removed UI: Search input + theme toggle button
    expect(header).not.toMatch(/Search\b/);
    expect(header).not.toContain("⌘ K");
    expect(header).not.toContain('aria-label="Toggle theme"');
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
    // The lucode Docs link points at the new root route
    expect(config).toContain("link: '/introduction/'");
  });
});