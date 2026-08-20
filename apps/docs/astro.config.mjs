// @ts-check
import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import grove from '@grove-dev/starlight';
import tailwindcss from '@tailwindcss/vite';
import { REDIRECTS } from './src/data/redirects.mjs';
import { SIDEBAR } from './src/data/docs-sidebar.mjs';
import { buildLastmodMap } from './src/lib/git-lastmod.mjs';

// Per-file last-commit dates for sitemap <lastmod>. Empty map when git
// history is unavailable (the sitemap then omits lastmod entirely).
const lastmodMap = buildLastmodMap();

/** Map a page URL to its content file's last-commit date, if known. */
function lastmodFor(url) {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
    if (!path) return undefined;
    return (
        lastmodMap.get(`${path}.md`) ??
        lastmodMap.get(`${path}.mdx`) ??
        lastmodMap.get(`${path}/index.md`) ??
        lastmodMap.get(`${path}/index.mdx`)
    );
}

// Grove docs — the canonical Astro/Starlight site for the project.
// Note: this site is NOT a Grove space. It is a Starlight docs site that
// uses the @grove-dev/starlight theme only; it has no data/records/, no
// grove.config.ts, and does not run @grove-dev/astro. The reference Grove
// space — the one `grove init` copies — is apps/example/.
export default defineConfig({
    site: 'https://withgrove.dev',
    // Astro's built-in redirects (added in Astro 5). The map lives in
    // src/data/redirects.mjs so the same data drives both these build-time
    // meta-refresh stubs (fallback for local preview / other hosts) and the
    // dist/_redirects file below, which Cloudflare serves as real 301s.
    redirects: REDIRECTS,
    vite: {
        plugins: [tailwindcss()],
    },
    integrations: [
        // Declared explicitly (Starlight only auto-adds @astrojs/sitemap when
        // absent) so entries can carry <lastmod> from git history.
        sitemap({
            serialize(item) {
                const lastmod = lastmodFor(item.url);
                return lastmod ? { ...item, lastmod } : item;
            },
        }),
        {
            name: 'grove-docs-redirects-file',
            hooks: {
                'astro:build:done': async ({ dir }) => {
                    const lines = Object.entries(REDIRECTS).map(
                        ([from, to]) => `${from} ${to} 301`,
                    );
                    await writeFile(new URL('_redirects', dir), lines.join('\n') + '\n');
                },
            },
        },
        starlight({
            // The custom landing page at "/" is the standalone Astro build
            // (src/pages/index.astro). The Starlight docs own every other
            // route. The introduction page lives at /introduction/ (its
            // content file is content/docs/introduction.md) and is linked
            // from the home header as the Docs entry.
            title: 'Grove',
            description:
                'Grove is a file-first publishing system for structured knowledge. Source files in, many useful outputs out — web pages, llms.txt, sitemap, JSON-LD, OG images, JSON datasets.',
            logo: {
                replacesTitle: false,
                alt: 'Grove',
                dark: './src/assets/logo-dark.svg',
                light: './src/assets/logo-light.svg',
            },
            customCss: ['./src/styles/global.css'],
            components: {
                // Adds per-page robots meta (noindex on 404) and
                // TechArticle + BreadcrumbList JSON-LD on top of
                // Starlight's default head.
                Head: './src/components/StarlightHead.astro',
            },
            // Starlight's default `editLink.baseUrl` would be inferred
            // from the GitHub repo metadata and produce a path under
            // `docs/src/content/docs/...` — but our content actually lives
            // at `apps/docs/src/content/docs/...`. Without this override,
            // every "Edit this page" link in production resolves to a
            // 404. Implementation-checklist.md #29.
            editLink: {
                baseUrl:
                    'https://github.com/tortuvshin/grove/edit/main/apps/docs/src/content/docs',
            },
            plugins: [
                grove({
                    docs: {
                        includeAiUtilities: true,
                    },
                    navLinks: [
                        { label: 'Docs', link: '/introduction/' },
                        { label: 'Roadmap', link: '/project/roadmap/' },
                        { label: 'FAQ', link: '/project/faq/' },
                        { label: 'GitHub', link: 'https://github.com/tortuvshin/grove', attrs: { target: '_blank', rel: 'noopener noreferrer' } },
                    ],
                }),
            ],
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/tortuvshin/grove' },
            ],
            head: [
                // Mobile / PWA defaults — paired with public/manifest.json and
                // public/og-image.svg. Lighthouse "best practices" expects
                // these on every page so the home/launch icon, theme color,
                // and PWA install hint are never missing.
                // Docs surface background is --background: oklch(14.5% 0 0)
                // (~#0a0a0a) in dark mode and white in light mode; scope the
                // browser-chrome color to the active scheme. The home page
                // sets its own (#091116) in HomeLayout.astro.
                { tag: 'meta', attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0a0a0a' } },
                { tag: 'meta', attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#ffffff' } },
                { tag: 'meta', attrs: { name: 'color-scheme', content: 'dark light' } },
                { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.json' } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' } },
                { tag: 'link', attrs: { rel: 'sitemap', href: '/sitemap-index.xml' } },
                // Machine-readable index of the docs for LLM agents; the
                // endpoints live at src/pages/llms{,-full}.txt.ts.
                { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'LLM-readable docs index' } },
                // Open Graph image (default for every Starlight content
                // page). Individual pages can override via frontmatter
                // `socialImage: { src: '...' }`. Starlight emits
                // og:title / og:type / og:url / og:description / twitter:card
                // on its own — we only fill the dimensional + image pieces
                // it leaves blank. Must be a raster image: social platforms
                // do not render SVG cards (public/og-image.png is generated
                // from og-image.svg by scripts/generate-social-assets.mjs).
                { tag: 'meta', attrs: { property: 'og:image', content: 'https://withgrove.dev/og-image.png' } },
                { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://withgrove.dev/og-image.png' } },
                { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
                { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
                { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
                { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Grove — The framework for community knowledge' } },
                { tag: 'meta', attrs: { name: 'twitter:image:alt', content: 'Grove — The framework for community knowledge' } },
                // JSON-LD WebSite schema (organization + search action) on
                // every Starlight content page. The home page renders richer
                // schemas via HomeLayout.astro.
                {
                    tag: 'script',
                    attrs: { type: 'application/ld+json' },
                    content: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        name: 'Grove',
                        url: 'https://withgrove.dev',
                        description:
                            'Grove is an open-source framework for growing useful community knowledge — collect, structure, maintain, and improve the projects, tools, resources, and knowledge a community relies on.',
                        inLanguage: 'en',
                        publisher: {
                            '@type': 'Organization',
                            name: 'Grove',
                            url: 'https://github.com/tortuvshin/grove',
                        },
                        // SearchAction intentionally omitted: the docs site
                        // uses Starlight's client-side search overlay, which
                        // is not exposed at a real `/search?q=...` route.
                        // Google's Rich Results guidelines flag an
                        // unreachable `target` as invalid structured data,
                        // so we omit it until a server-rendered search
                        // route exists.
                    }),
                },
            ],
            // Shared with the llms.txt endpoint — see src/data/docs-sidebar.mjs
            // (which also documents the section ordering rationale).
            sidebar: SIDEBAR,
        }),
    ],
});
