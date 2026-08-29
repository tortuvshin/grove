import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const docsRoot = resolve(import.meta.dirname, '..');

const readComponent = (name: string) =>
  readFile(resolve(docsRoot, `src/components/home/${name}.astro`), 'utf8');

describe('docs homepage (standalone Astro route)', () => {
  it('uses a custom pages/index.astro that overrides the Starlight splash route', async () => {
    const indexAstroPath = resolve(docsRoot, 'src/pages/index.astro');
    expect(existsSync(indexAstroPath)).toBe(true);

    const indexAstro = await readFile(indexAstroPath, 'utf8');

    // Imports the home layout and all 9 section components from src/components/home/
    expect(indexAstro).toContain("import Layout from '../layouts/HomeLayout.astro'");
    for (const name of [
      'Header',
      'Hero',
      'Features',
      'Demo',
      'OpenApps',
      'Faq',
      'FinalCta',
      'Footer',
    ]) {
      expect(indexAstro).toContain(`import ${name} from '../components/home/${name}.astro'`);
    }

    // Renders every section in the vite.dev-style order: hero (which now
    // carries the transformation diagram in its right column) → feature
    // grid → live demo → production story → FAQ → gradient CTA band.
    expect(indexAstro).toMatch(
      /<Header\s*\/>\s*<main id="main-content">\s*<Hero\s*\/>\s*<Features\s*\/>\s*<Demo\s*\/>\s*<OpenApps\s*\/>\s*<Faq\s*\/>\s*<FinalCta\s*\/>\s*<\/main>\s*<Footer\s*\/>/,
    );

    // Superseded sections from earlier iterations must stay deleted.
    for (const name of [
      'GetStarted',
      'ProofBar',
      'Blueprints',
      'Frameworks',
      'Problem',
      'HowItWorks',
      'Health',
      'WhyGrove',
      'Decay',
      'Lifecycle',
      'Discovery',
      'Records',
      'Integrations',
      'Build',
    ]) {
      expect(existsSync(resolve(docsRoot, `src/components/home/${name}.astro`)), name).toBe(false);
    }
  });

  it('uses a standalone HomeLayout (not BaseLayout) and only Tailwind on the body', async () => {
    const layoutSource = await readFile(resolve(docsRoot, 'src/layouts/HomeLayout.astro'), 'utf8');

    // Pulls in only the standalone stylesheet — no Starlight tokens
    // (the home uses components/home/Header.astro, which is Tailwind-only).
    // The full boundary is enforced in docs-style-boundary.test.ts.
    expect(layoutSource).toContain("import '../styles/home.css'");
    expect(layoutSource).not.toContain("import '../styles/global.css'");
    expect(layoutSource).not.toContain('Sidebar');
    expect(layoutSource).not.toContain('--sl-color');
    expect(layoutSource).not.toContain('--sl-font');
    expect(layoutSource).not.toContain('var(--sl-');

    // Tailwind classes on body for the standalone theme
    expect(layoutSource).toMatch(/class="min-h-screen bg-bg text-fg antialiased"/);
  });

  it('ships the home stylesheet with the Grove blue + teal palette and no webfonts', async () => {
    const homeCss = await readFile(resolve(docsRoot, 'src/styles/home.css'), 'utf8');

    expect(homeCss).toMatch(/@import\s+['"]tailwindcss['"]/);
    expect(homeCss).toMatch(/@theme\s*\{/);

    // Ink-dark canvas + teal emphasis; the old indigo/purple palette is gone.
    expect(homeCss).toMatch(/--color-bg:\s*#091116/);
    expect(homeCss).toMatch(/--color-surface:\s*#111d25/);
    expect(homeCss).toMatch(/--color-fg:\s*#e3f3f5/);
    expect(homeCss).toMatch(/--color-muted:\s*#89a8b3/);
    expect(homeCss).toMatch(/--color-brand:\s*#27b7c8/);
    expect(homeCss).toMatch(/--color-brand-light:\s*#7dd3d8/);
    expect(homeCss).toContain('linear-gradient(120deg, #7dd3d8 8%, #27b7c8 58%, #4ac987 96%)');
    expect(homeCss).not.toMatch(/#646cff|#41d1ff|#bd34fe/i);

    // The landing page's own font decision: the system stack, no webfont
    // imports, so the first paint is never blocked on a font request.
    expect(homeCss).toMatch(/--font-sans:\s*ui-sans-serif/);
    expect(homeCss).toMatch(/--font-mono:\s*ui-monospace/);
    expect(homeCss).not.toMatch(/@fontsource|fraunces|@font-face/i);

    // The landing page's own radius ladder. Not derived from the docs
    // theme -- the two surfaces are independent (docs-style-boundary.test.ts).
    expect(homeCss).toMatch(/--radius-lg:\s*0\.625rem/);
    expect(homeCss).toMatch(/--radius-2xl:\s*0\.875rem/);

    // No Starlight tokens leak in
    expect(homeCss).not.toContain('--sl-');
  });

  it('keeps the webfont out of the docs package dependencies', async () => {
    const pkg = await readFile(resolve(docsRoot, 'package.json'), 'utf8');
    expect(pkg).not.toContain('@fontsource/fraunces');
  });

  it('wires @tailwindcss/vite into astro.config.mjs alongside Starlight', async () => {
    const config = await readFile(resolve(docsRoot, 'astro.config.mjs'), 'utf8');

    expect(config).toContain("import tailwindcss from '@tailwindcss/vite'");
    expect(config).toMatch(/vite:\s*\{[\s\S]*plugins:\s*\[tailwindcss\(\)\]/);

    // Starlight integration still present (other docs pages need it)
    expect(config).toContain('starlight({');
    expect(config).toContain("import grove from '@grove-dev/starlight'");
  });

  it('removes the Starlight splash content/docs/index.mdx so the custom route owns /', async () => {
    const splashPath = resolve(docsRoot, 'src/content/docs/index.mdx');
    expect(existsSync(splashPath)).toBe(false);
  });

  it('uses withgrove.dev as the canonical site URL everywhere it appears', async () => {
    const config = await readFile(resolve(docsRoot, 'astro.config.mjs'), 'utf8');
    expect(config).toContain("site: 'https://withgrove.dev'");
    expect(config).not.toMatch(/site:\s*['"]https:\/\/grove\.dev['"]/);
    expect(config).not.toMatch(/grove\.tortuvshin\.dev/);

    const release = await readFile(
      resolve(docsRoot, 'src/content/docs/maintainers/release-process.md'),
      'utf8',
    );
    expect(release).toContain('withgrove.dev');
    expect(release).not.toContain('to grove.dev)');

    const homeLayout = await readFile(resolve(docsRoot, 'src/layouts/HomeLayout.astro'), 'utf8');
    expect(homeLayout).toContain('https://withgrove.dev');
    expect(homeLayout).not.toContain("https://grove.dev'");
  });

  it("renders the hero as the story's first frame: pitch left, transformation diagram right", async () => {
    const hero = await readComponent('Hero');

    // Two columns: the pitch is left-aligned from `lg` up, and the
    // diagram that used to sit halfway down the page rides alongside it.
    expect(hero).toContain("import Pipeline from './Pipeline.astro'");
    expect(hero).toContain('<Pipeline />');
    expect(hero).toContain('lg:text-left');

    // Micro badge + positioning line, closing phrase in the animated
    // signature gradient.
    expect(hero).toContain('Open source');
    expect(hero).toContain('Publish structured knowledge');
    expect(hero).toContain('that stays current.');
    expect(hero).toContain('text-gradient-live');

    // Positioned as file-first publishing, with a directory as one example
    // among several — not as a directory builder. See CLAUDE.md.
    expect(hero).toContain('Directories, catalogs, handbooks, reference sites');
    expect(hero).toContain('machine-readable output');
    expect(hero).not.toContain('Build directories');

    // Three calls to action pointing at real destinations. The install
    // command is deliberately not one of them — it belongs in the docs,
    // not in the first frame.
    expect(hero).toContain('href="/getting-started/scaffold/"');
    expect(hero).toContain('Get started');
    expect(hero).toContain('Read the docs');
    expect(hero).toContain('href="/introduction/"');
    expect(hero).toContain('View on GitHub');
    // target/rel come from <Button external>, not from hand-written attrs.
    expect(hero).toContain(
      'href="https://github.com/tortuvshin/grove" variant="secondary" external',
    );
    expect(hero).toContain('href="/project/roadmap/"');
    expect(hero).not.toContain('npx @grove-dev/cli init');
    expect(hero).not.toContain('navigator.clipboard');
    expect(hero).not.toContain('<pre');

    // Fills the first screen under the sticky h-16 header, with an `svh`
    // unit so mobile browser chrome cannot leak the next section in.
    expect(hero).toContain('calc(100svh - 4rem)');

    // Aurora field degrades gracefully. The growing mark has moved to the
    // How Grove works finale and must not linger here.
    expect(hero).toContain('hero-beams');
    expect(hero).toContain('prefers-reduced-motion');
    expect(hero).not.toContain('hero-mark');
    expect(hero).not.toContain('hero-sway');

    // Honesty strip.
    expect(hero).toContain('No database · No CMS · MIT licensed');
  });

  it('explains the product with an eight-card, plain-language feature grid', async () => {
    const features = await readComponent('Features');

    expect(features).toContain('id="features"');
    expect(features).toContain('Write it once.');
    expect(features).toContain('Publish it everywhere.');
    expect(features).not.toContain('directory maintenance');

    // Eight benefit-first cards; each maps to shipped behavior.
    for (const title of [
      'Ready in a minute',
      'Search and saved views',
      'Curated collections',
      'Rich detail pages',
      'Self-updating facts',
      'Nothing rots quietly',
      'One source, many outputs',
      'Yours to own',
    ]) {
      expect(features, title).toContain(title);
    }

    // User-language claims that map to real mechanisms.
    expect(features).toContain('review queue');
    expect(features).toContain('llms.txt');
    expect(features).toContain('No database, no CMS');

    // One space's configuration is not a product fact: the lens names, the
    // GitHub-specific fields, and the staleness threshold belong to Open
    // Apps and must stay out of the top-level grid.
    for (const leak of [
      'Production-like',
      'Good to learn',
      'Trending',
      '183 days',
      '183+',
      'Stars, licenses',
    ]) {
      expect(features, leak).not.toContain(leak);
    }

    // No terminal output in the feature grid — it speaks user, not CLI.
    expect(features).not.toContain('<pre');
  });

  it('tells the How Grove works story as a scroll scrub that ends in the live demo', async () => {
    const demo = await readComponent('Demo');

    expect(demo).toContain('id="demo"');
    expect(demo).toContain('How Grove works');
    expect(demo).toContain('living site.');

    // Five-step narrative: strictly sequential scenes, no cross-fades.
    // (The transformation diagram lives in the hero now.)
    for (const label of ['Initialize', 'Add content', 'Publish', 'Deploy', 'Automate']) {
      expect(demo, label).toContain(label);
    }
    expect(demo).not.toContain('id="hgw-system"');

    // Scene 1 types the real CLI command; scene 2 mirrors the real
    // `grove init` scaffold (packages/cli/src/init.ts copies apps/example).
    expect(demo).toContain('grove init my-space');
    for (const path of ['data/', 'records/', 'collections/', 'taxonomy/', 'grove.config.ts']) {
      expect(demo, path).toContain(path);
    }

    // Scene 4 shows real deploy targets for the static output; scene 5
    // stays truthful to the 183-day staleness threshold and closes on
    // the Grove mark.
    expect(demo).toContain('Deploy anywhere');
    for (const host of ['Vercel', 'Netlify', 'Cloudflare', 'GitHub Pages']) {
      expect(demo, host).toContain(host);
    }
    expect(demo).toContain('Collection health');
    expect(demo).toContain('183');
    expect(demo).toContain('id="hgw-finale"');

    // The finale closes on the growing Grove mark, which the hero used to
    // own: seed, stem, leaves, and shoots, started once by the scrub loop.
    for (const cls of ['hgw-seed', 'hgw-stem', 'hgw-leaf', 'hgw-shoot', 'hgw-sway']) {
      expect(demo, cls).toContain(cls);
    }
    expect(demo).toContain("classList.add('is-growing')");

    // The scrub is a progressive enhancement, but it now runs at every
    // viewport width: reduced motion is the only thing that turns it off,
    // and it tears down cleanly when that changes.
    expect(demo).toContain('id="hgw"');
    expect(demo).toContain('height: 440vh');
    expect(demo).toContain('const stepStarts = [0, 0.21, 0.47, 0.675, 0.835]');
    expect(demo).toContain('scroll-snap-type: inline mandatory');
    expect(demo).toContain('Swipe to explore all five steps');
    expect(demo).toContain('prefers-reduced-motion');
    expect(demo).toContain('setEnabled(!motion.matches)');
    expect(demo).not.toContain("min-width: 1024px)');");

    // Fast flicks ease into place instead of snapping past every scene:
    // an exponential ease shapes the arrival, and a rate ceiling is what
    // stops all five scenes crossing in a fraction of a second.
    expect(demo).toContain('const TAU = 0.22');
    expect(demo).toContain('Math.exp(-dt / TAU)');
    expect(demo).toContain('const MAX_RATE = 0.5');
    expect(demo).toContain('const cap = MAX_RATE * dt');

    // The window and side rail live in one composition that is fitted with
    // a single resize-computed scale — scroll never changes its size.
    expect(demo).toContain('id="hgw-composition"');
    expect(demo).toContain('const fit = ()');
  });

  it('ships a live, filterable directory demo wired to the real lens definitions', async () => {
    const demo = await readComponent('Demo');

    expect(demo).toContain('id="demo-directory"');
    expect(demo).toContain('id="demo-directory-search"');
    expect(demo).toContain('Tools worth knowing');
    expect(demo).toContain('sm:grid-cols-3');
    expect(demo).not.toContain('id="hgw-bridge"');

    // Lens labels are the real PRIMARY_LENSES from
    // packages/core/src/directory-lenses.ts, and each tab writes the same
    // URL params as toParams().
    for (const label of [
      'All items',
      'Trending',
      'Established',
      'Production-like',
      'Good to learn',
    ]) {
      expect(demo, label).toContain(label);
    }
    expect(demo).toContain('label=hot');
    expect(demo).toContain('label=mature');
    expect(demo).toContain('lens=production-like');
    expect(demo).toContain('lens=good-to-learn');
    expect(demo).toContain('data-lenses');
    expect(demo).toContain('aria-live="polite"');
  });

  it("presents the transformation diagram as the hero's right column", async () => {
    const pipeline = await readComponent('Pipeline');

    // A visual inside the hero, not a page section: no <section>, no
    // heading of its own, and the phrase it used to head survives as a
    // label so the hero still says what Grove produces.
    expect(pipeline).toContain('id="pipeline-stage"');
    expect(pipeline).toContain('One source, every surface');
    expect(pipeline).not.toContain('<section');
    expect(pipeline).not.toContain('Statement.astro');

    // Inputs are the files users actually write.
    for (const input of ['YAML records', 'Markdown', 'Collections', 'Taxonomy']) {
      expect(pipeline, input).toContain(input);
    }

    // Outputs map to shipped behavior: site capabilities, SEO files,
    // AI indexes, and repo artifacts.
    for (const output of [
      'Search',
      'Filters',
      'Lenses',
      'Detail pages',
      'sitemap.xml',
      'robots.txt',
      'llms.txt',
      'llms-full.txt',
      'README.md',
    ]) {
      expect(pipeline, output).toContain(output);
    }

    // Enhancement only: reveal and connector paths gate on reduced motion.
    // The flow is vertical at every width, so unlike the old three-column
    // section there is no viewport gate on drawing the connectors.
    expect(pipeline).toContain('prefers-reduced-motion');
    expect(pipeline).toContain('IntersectionObserver');
    expect(pipeline).not.toContain('min-width: 768px');
  });

  it('keeps the Open Apps production story with a real product screenshot', async () => {
    const openApps = await readComponent('OpenApps');

    expect(openApps).toContain('Grove grew out of maintaining Open Apps.');
    expect(openApps).toContain('id="open-apps"');

    // The live space is openappscout.com, in both the links and the mock
    // address bar. The old host does not resolve, so it must not come
    // back as a destination (the frontmatter comment naming it is fine).
    expect(openApps).toContain('https://openappscout.com');
    expect(openApps).not.toContain('https://open-apps.dev.mn');
    expect(openApps).not.toContain('open-apps.dev.mn/apps');

    // A real screenshot (astro:assets) replaced the hand-built mock; the
    // honesty caveat about the pending package migration stays.
    expect(openApps).toContain('astro:assets');
    expect(openApps).toContain('open-apps-home.png');
    expect(openApps).toContain('published Grove packages');
  });

  it('renders every landing call to action through the shared Button', async () => {
    const button = await readComponent('Button');

    // One radius, one primary fill, one secondary treatment.
    expect(button).toContain('rounded-lg');
    expect(button).toContain('bg-brand text-bg hover:bg-brand-light');
    expect(button).toContain('border border-border bg-card/70');
    // External links carry target/rel from the component, not by hand.
    expect(button).toContain("rel: 'noopener noreferrer'");

    // No section may hand-roll its own button any more — the rounded-full
    // pill and the bg-fg fill were the two treatments that had drifted.
    for (const name of ['Hero', 'OpenApps', 'FinalCta']) {
      const src = await readComponent(name);
      expect(src, name).toContain("import Button from './Button.astro'");
      expect(src, name).not.toContain('rounded-full bg-fg');
      expect(src, name).not.toContain('rounded-full border border-border-strong');
    }
  });

  it('seats the footer directly under the closing CTA', async () => {
    const footer = await readComponent('Footer');

    // A top margin here exposes a bare strip of page background between
    // the CTA's gradient and the footer's top border.
    expect(footer).toMatch(/<footer class="border-t/);
    expect(footer).not.toContain('<footer class="mt-');
  });

  it('closes with a full-bleed gradient CTA band and a package-manager tabbed install command', async () => {
    const finalCta = await readComponent('FinalCta');

    expect(finalCta).toContain('Start growing with Grove.');
    expect(finalCta).toContain('cta-gradient');
    expect(finalCta).toContain('href="/getting-started/scaffold/"');
    expect(finalCta).toContain('href="https://github.com/tortuvshin/grove"');

    // One command, four runners; pnpm (the scaffold's own manager) is the
    // no-JS default panel.
    expect(finalCta).toContain('npx @grove-dev/cli@latest init my-space');
    expect(finalCta).toContain('pnpm dlx @grove-dev/cli@latest init my-space');
    expect(finalCta).toContain('yarn dlx @grove-dev/cli@latest init my-space');
    expect(finalCta).toContain('bunx @grove-dev/cli@latest init my-space');
    expect(finalCta).toContain('role="tablist"');
    expect(finalCta).toContain('aria-live="polite"');
    expect(finalCta).toContain('navigator.clipboard');
  });

  it('wires each section to its heading via aria-labelledby for assistive tech', async () => {
    // Both shared heading components own an identifiable <h2 id>.
    const sectionHeader = await readComponent('SectionHeader');
    expect(sectionHeader).toMatch(/<h2[^>]+id=/);
    const statement = await readComponent('Statement');
    expect(statement).toMatch(/<h2[^>]+id=/);

    const hero = await readComponent('Hero');
    expect(hero).toMatch(/<section[^>]+aria-labelledby=/);
    expect(hero).toMatch(/<h1[^>]+id=/);

    for (const name of ['Features', 'Demo', 'OpenApps', 'Faq', 'FinalCta']) {
      const src = await readComponent(name);
      expect(src, name).toMatch(/<section[^>]+aria-labelledby=/);
    }
  });

  it('exposes robots.txt, an OG image, and a PWA manifest under public/', async () => {
    const robots = await readFile(resolve(docsRoot, 'public/robots.txt'), 'utf8');
    expect(robots).toMatch(/^User-agent:\s*\*/m);
    expect(robots).toMatch(/^Allow:\s*\//m);
    expect(robots).toContain('https://withgrove.dev/sitemap.xml');

    const manifest = JSON.parse(await readFile(resolve(docsRoot, 'public/manifest.json'), 'utf8'));
    expect(manifest.name).toBe('Grove');
    expect(manifest.start_url).toBe('/');
    expect(manifest.background_color).toBe('#091116');
    expect(manifest.theme_color).toBe('#091116');
    const iconSrcs = (manifest.icons ?? []).map((icon) => icon.src);
    expect(iconSrcs).toContain('/favicon.svg');
    expect(iconSrcs).toContain('/icons/icon-192.png');
    expect(iconSrcs).toContain('/icons/icon-512.png');
    expect(iconSrcs).toContain('/icons/icon-512-maskable.png');
    expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true);

    expect(existsSync(resolve(docsRoot, 'public/og-image.svg'))).toBe(true);
    // Raster twins generated by scripts/generate-social-assets.mjs —
    // social platforms do not render SVG og:images, and iOS/Android
    // ignore SVG touch/launcher icons.
    expect(existsSync(resolve(docsRoot, 'public/og-image.png'))).toBe(true);
    expect(existsSync(resolve(docsRoot, 'public/apple-touch-icon.png'))).toBe(true);
    expect(existsSync(resolve(docsRoot, 'public/logo.png'))).toBe(true);
    expect(existsSync(resolve(docsRoot, 'public/_headers'))).toBe(true);
  });

  it('emits WebSite + SoftwareApplication + Organization JSON-LD on the home layout', async () => {
    const home = await readFile(resolve(docsRoot, 'src/layouts/HomeLayout.astro'), 'utf8');
    expect(home).toContain("'@type': 'WebSite'");
    expect(home).toContain("'@type': 'SoftwareApplication'");
    expect(home).toContain("'@type': 'Organization'");
    expect(home).toContain("'@context': 'https://schema.org'");
    // All schemas reference the canonical site URL through the `siteUrl`
    // helper. The literal fallback is asserted once; the rest are
    // computed at build time from Astro.site.
    expect(home).toContain('https://withgrove.dev');
    expect(home).toContain('url: siteUrl');
    expect(home).not.toContain("'@type': 'SearchAction'");
  });

  it('emits a global WebSite JSON-LD on every Starlight page via head config', async () => {
    const config = await readFile(resolve(docsRoot, 'astro.config.mjs'), 'utf8');
    expect(config).toMatch(/head:\s*\[/);
    expect(config).toContain("'@type': 'WebSite'");
    expect(config).toContain("'@context': 'https://schema.org'");
    expect(config).not.toContain("'@type': 'SearchAction'");
    expect(config).toContain("'application/ld+json'");
  });

  it('sets OG + Twitter + theme metadata on the home and Starlight head config', async () => {
    const home = await readFile(resolve(docsRoot, 'src/layouts/HomeLayout.astro'), 'utf8');
    const config = await readFile(resolve(docsRoot, 'astro.config.mjs'), 'utf8');

    // Home layout writes the tags as literal HTML.
    expect(home).toContain('property="og:image"');
    expect(home).toContain('property="og:image:width"');
    expect(home).toContain('property="og:image:height"');
    expect(home).toContain('property="og:image:alt"');
    expect(home).toContain('name="twitter:card"');
    expect(home).toContain('content="summary_large_image"');
    expect(home).toContain('name="theme-color"');
    expect(home).toContain('content="#091116"');
    expect(home).toContain('name="robots"');
    expect(home).toContain('content="index,follow,max-image-preview:large"');
    expect(home).toContain('rel="manifest"');
    expect(home).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(home).toContain("'/og-image.png'");
    expect(home).toContain('rel="sitemap"');
    expect(home).toContain('href="/llms.txt"');
    // Social alt text follows the positioning brand line.
    expect(home).toContain('Grove — Publish structured knowledge that stays current');

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
    expect(config).toContain("property: 'og:image:type'");
    expect(config).toContain("name: 'theme-color'");
    // Browser-chrome color tracks the docs surface background per scheme.
    expect(config).toContain("content: '#0a0a0a'");
    expect(config).toContain("content: '#ffffff'");
    expect(config).toContain("rel: 'manifest'");
    expect(config).toContain("rel: 'apple-touch-icon'");
    expect(config).toContain("'/apple-touch-icon.png'");
    expect(config).toContain("rel: 'sitemap'");
    expect(config).toContain("'/llms.txt'");
    expect(config).toContain('https://withgrove.dev/og-image.png');
  });

  it('serves focused navigation with a mobile menu', async () => {
    const header = await readComponent('Header');

    expect(header).toContain('#features');
    expect(header).toContain('#demo');
    expect(header).toContain('#open-apps');
    expect(header).toContain('/introduction/');
    expect(header).toContain('/project/roadmap/');
    expect(header).toContain('/getting-started/scaffold/');

    // GitHub icon links to the project repo, opens in a new tab
    expect(header).toContain('https://github.com/tortuvshin/grove');
    expect(header).toContain('target="_blank"');
    expect(header).toContain('rel="noopener noreferrer"');

    // Removed UI: Search input + theme toggle button
    expect(header).not.toMatch(/Search\b/);
    expect(header).not.toContain('⌘ K');
    expect(header).not.toContain('aria-label="Toggle theme"');
    expect(header).toContain('aria-label="Open navigation menu"');
  });

  it('hosts the introduction page at /introduction/ with the Getting Started sidebar trimmed', async () => {
    // The intro file moved out of getting-started/ so it renders at the root.
    expect(existsSync(resolve(docsRoot, 'src/content/docs/introduction.mdx'))).toBe(true);
    expect(existsSync(resolve(docsRoot, 'src/content/docs/getting-started/introduction.md'))).toBe(
      false,
    );

    const config = await readFile(resolve(docsRoot, 'astro.config.mjs'), 'utf8');
    // Intro was removed from the Getting Started sidebar (now 3 items)
    expect(config).not.toContain("slug: 'getting-started/introduction'");
    // The Grove plugin's Docs link points at the new root route
    expect(config).toContain("link: '/introduction/'");
  });

  it('mounts the FAQ section, the shared FAQ data module, and the FAQPage JSON-LD', async () => {
    const indexAstro = await readFile(resolve(docsRoot, 'src/pages/index.astro'), 'utf8');
    expect(indexAstro).toContain("import Faq from '../components/home/Faq.astro'");
    expect(indexAstro).toMatch(/<Faq\s*\/>/);

    const faq = await readComponent('Faq');
    // The FAQ list is generated by `.map(FAQ_ITEMS)`; assert that the
    // component wires through the shared module so JSON-LD cannot drift.
    expect(faq).toContain("from '../../data/faq.ts'");
    expect(faq).toMatch(/faqs\.map/);

    const faqData = await readFile(resolve(docsRoot, 'src/data/faq.ts'), 'utf8');
    // Six Q&A pairs in the shared module.
    const itemCount = (faqData.match(/\bq:\s*['"]/g) ?? []).length;
    expect(itemCount).toBe(6);

    const homeLayout = await readFile(resolve(docsRoot, 'src/layouts/HomeLayout.astro'), 'utf8');
    // FAQPage schema.org block is emitted, sourced from the same module.
    expect(homeLayout).toContain("'@type': 'FAQPage'");
    expect(homeLayout).toContain("from '../data/faq.ts'");
  });

  it('wires the mobile menu button with aria-expanded, aria-controls, Escape, and click-outside', async () => {
    const header = await readComponent('Header');

    expect(header).toContain('id="mobile-nav-toggle"');
    expect(header).toContain('id="mobile-nav-panel"');
    expect(header).toContain('aria-controls="mobile-nav-panel"');
    expect(header).toContain('aria-expanded="false"');
    expect(header).toContain('aria-label="Open navigation menu"');

    // Script-level behaviours — these all need to be present for a
    // real keyboard/screen-reader user to operate the menu.
    expect(header).toContain("e.key === 'Escape'");
    expect(header).toContain('toggle.focus()');
    expect(header).toContain('panel.hidden');
  });
});
