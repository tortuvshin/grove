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

  it("does not depend on Starlight — uses HomeLayout (not BaseLayout) and no --sl-* tokens", async () => {
    const layoutSource = await readFile(
      resolve(docsRoot, "src/layouts/HomeLayout.astro"),
      "utf8",
    );

    // Uses the standalone home layout, not the Starlight BaseLayout
    expect(layoutSource).toContain("import '../styles/home.css'");
    expect(layoutSource).not.toContain("BaseLayout");
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
});