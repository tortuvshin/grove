import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The landing page at `/` and the Starlight docs are two independent themes
 * that happen to be built by one Astro project. Neither may constrain the
 * other's design, so they share no stylesheet, no design tokens, and no CSS
 * bundle:
 *
 *   landing -> src/pages/index.astro -> src/layouts/HomeLayout.astro
 *              -> src/styles/home.css (Tailwind, own @theme)
 *   docs    -> Starlight + @grove-dev/starlight
 *              -> src/styles/global.css (customCss)
 *
 * These tests are the guard rail: they fail the moment either surface starts
 * reaching into the other's styling.
 */

const docsRoot = resolve(import.meta.dirname, '..');
const read = (path: string) => readFile(resolve(docsRoot, path), 'utf8');

/**
 * These assertions are about what a stylesheet *does*, not what it says about
 * itself: both files explain the boundary in their header comment, and those
 * comments legitimately name the other surface's tokens and paths.
 */
const stripCssComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const readCss = async (path: string) => stripCssComments(await read(path));

/** Every file that makes up the landing surface. */
const landingFiles = async () => {
  const homeComponents = await readdir(resolve(docsRoot, 'src/components/home'));
  return [
    'src/pages/index.astro',
    'src/layouts/HomeLayout.astro',
    'src/styles/home.css',
    ...homeComponents.map((name) => `src/components/home/${name}`),
  ];
};

describe('landing / docs style boundary', () => {
  it('keeps the deleted Starlight-mirroring chrome out of the docs app', async () => {
    // BaseLayout.astro + its Header/Footer existed only to mirror Starlight's
    // chrome on custom Astro pages. Nothing rendered them, BaseLayout imported
    // a Sidebar.astro that does not exist, and the real template layout lives
    // in packages/astro/src/layouts/BaseLayout.astro. Reintroducing them here
    // would rebuild the bridge between the two surfaces.
    for (const path of [
      'src/layouts/BaseLayout.astro',
      'src/components/Header.astro',
      'src/components/Footer.astro',
    ]) {
      expect(existsSync(resolve(docsRoot, path)), path).toBe(false);
    }

    // src/components/ is the landing page's alone.
    const components = await readdir(resolve(docsRoot, 'src/components'));
    expect(components).toEqual(['home']);
  });

  it('never lets the landing surface reference Starlight tokens or the docs stylesheet', async () => {
    for (const path of await landingFiles()) {
      const source = path.endsWith('.css') ? await readCss(path) : await read(path);
      expect(source, `${path} uses a Starlight token`).not.toContain('--sl-');
      expect(source, `${path} imports the docs stylesheet`).not.toContain('styles/global.css');
    }
  });

  it('never lets the docs stylesheet reference Tailwind or the landing tokens', async () => {
    const docsCss = await readCss('src/styles/global.css');

    expect(docsCss).not.toMatch(/@import\s+['"]tailwindcss['"]/);
    expect(docsCss).not.toContain('@theme');
    for (const token of ['--color-bg', '--color-fg', '--color-brand', '--color-surface']) {
      expect(docsCss, `docs stylesheet uses landing token ${token}`).not.toContain(token);
    }

    // Container tokens/utilities that only the deleted BaseLayout consumed.
    expect(docsCss).not.toContain('--g-container');
    expect(docsCss).not.toContain('.g-container');
  });

  it("scopes Tailwind's class scanning to the landing page's own files", async () => {
    // Without source(none) Tailwind scans all of apps/docs, so prose in
    // src/content/docs/** could emit utilities into the landing stylesheet.
    const homeCss = await readCss('src/styles/home.css');

    expect(homeCss).toMatch(/@import\s+['"]tailwindcss['"]\s+source\(none\)/);
    for (const source of [
      '../components/home',
      '../layouts/HomeLayout.astro',
      '../pages/index.astro',
    ]) {
      expect(homeCss, `missing @source ${source}`).toMatch(
        new RegExp(`@source\\s+['"]${source.replace(/\./g, '\\.')}['"]`),
      );
    }
    expect(homeCss).not.toContain('src/content');
  });

  it("loads the docs stylesheet only through Starlight's customCss", async () => {
    const config = await read('astro.config.mjs');
    expect(config).toContain("customCss: ['./src/styles/global.css']");
    expect(config).not.toContain('home.css');

    // The landing layout is the only importer of the landing stylesheet.
    const homeLayout = await read('src/layouts/HomeLayout.astro');
    expect(homeLayout).toContain("import '../styles/home.css'");
  });
});
