// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';
import tailwindcss from '@tailwindcss/vite';

// Grove docs — the canonical Astro/Starlight site for the project.
// This is a Starlight site themed with @grove-dev/starlight. It is *not*
// a Grove record space: it has no grove.config.ts, no data/records, and
// does not run the publishing pipeline. The landing page at "/" is a
// standalone Astro route; Starlight owns everything else.
export default defineConfig({
    site: 'https://withgrove.dev',
    vite: {
        plugins: [tailwindcss()],
    },
    integrations: [
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
                        { label: 'Open Apps', link: '/open-apps/' },
                        { label: 'Docs', link: '/introduction/' },
                        { label: 'Roadmap', link: '/roadmap' },
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
                { tag: 'meta', attrs: { name: 'theme-color', content: '#08090a' } },
                { tag: 'meta', attrs: { name: 'color-scheme', content: 'dark light' } },
                { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.json' } },
                { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/og-image.svg' } },
                // Open Graph image (default for every Starlight content
                // page). Individual pages can override via frontmatter
                // `socialImage: { src: '...' }`. Starlight emits
                // og:title / og:type / og:url / og:description / twitter:card
                // on its own — we only fill the dimensional + image pieces
                // it leaves blank.
                { tag: 'meta', attrs: { property: 'og:image', content: 'https://withgrove.dev/og-image.svg' } },
                { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://withgrove.dev/og-image.svg' } },
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
            sidebar: [
                // One learning path, ordered by what a reader needs next:
                // understand it, build with it, publish it, keep it useful,
                // make it yours, look things up. The Starlight theme is a
                // separate product surface and lives in its own group;
                // maintainer process is collapsed so it never competes with
                // user documentation.
                {
                    label: 'Start here',
                    items: [
                        { label: 'Introduction', slug: 'introduction' },
                        { label: 'How Grove works', slug: 'concepts/philosophy' },
                        { label: 'Create a space', slug: 'getting-started/create-a-space' },
                        { label: 'Add your first record', slug: 'getting-started/add-your-first-project' },
                        { label: 'Configure your space', slug: 'getting-started/configure' },
                        { label: 'Deploy your site', slug: 'getting-started/deploy' },
                    ],
                },
                {
                    label: 'Build a knowledge site',
                    items: [
                        { label: 'Records', slug: 'sources/records' },
                        { label: 'Rich content pages', slug: 'sources/content-pages' },
                        { label: 'Taxonomy', slug: 'sources/taxonomy-files' },
                        { label: 'Curated collections', slug: 'sources/collections' },
                        { label: 'Blueprint: project directory', slug: 'blueprints/project-directory' },
                        { label: 'Blueprint: resource hub', slug: 'blueprints/resource-hub' },
                        { label: 'Blueprint: ecosystem map', slug: 'blueprints/ecosystem-map' },
                    ],
                },
                {
                    label: 'Publish everywhere',
                    items: [
                        { label: 'Generated outputs', slug: 'outputs/overview' },
                        { label: 'SEO and social', slug: 'outputs/seo' },
                        { label: 'Site metadata', slug: 'outputs/site-meta' },
                        { label: 'LLM-oriented outputs', slug: 'outputs/llm' },
                    ],
                },
                {
                    label: 'Keep it useful',
                    items: [
                        { label: 'Validation', slug: 'automation/validation' },
                        { label: 'GitHub metadata', slug: 'automation/github-metadata' },
                        { label: 'Sync deep-dive', slug: 'automation/sync-github-deep-dive' },
                        { label: 'Health classification', slug: 'sources/health-classification' },
                        { label: 'Decisions and overrides', slug: 'sources/decisions' },
                        { label: 'Scheduled maintenance', slug: 'automation/scheduled' },
                        { label: 'Community submissions', slug: 'automation/submissions' },
                    ],
                },
                {
                    label: 'Customize',
                    items: [
                        { label: 'Branding', slug: 'customize/branding' },
                        { label: 'Theme tokens', slug: 'customize/theme' },
                        { label: 'Components', slug: 'customize/components' },
                        { label: 'Page composition', slug: 'customize/pages' },
                        { label: 'Template customization', slug: 'customize/template-customization' },
                        { label: 'Images and assets', slug: 'customize/assets' },
                    ],
                },
                {
                    label: 'Deployment',
                    collapsed: true,
                    items: [
                        { label: 'Overview', slug: 'deployment/overview' },
                        { label: 'GitHub Pages', slug: 'deployment/github-pages' },
                        { label: 'Cloudflare', slug: 'deployment/cloudflare' },
                        { label: 'Netlify', slug: 'deployment/netlify' },
                        { label: 'Self-hosted', slug: 'deployment/self-hosted' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'Configuration', slug: 'reference/config' },
                        { label: 'Record schema', slug: 'reference/record-schema' },
                        { label: 'CLI', slug: 'reference/cli' },
                        { label: 'Core API', slug: 'reference/api-core' },
                        { label: 'Astro components', slug: 'reference/components' },
                        { label: 'Renderer status', slug: 'reference/frameworks' },
                        { label: 'Migration guide', slug: 'reference/migration' },
                        { label: 'Incremental build (proposed)', slug: 'architecture/incremental-build' },
                        { label: 'FAQ', slug: 'faq' },
                    ],
                },
                {
                    // A separate product: a Starlight theme, not the Grove
                    // publishing pipeline. Grouping it with the product docs
                    // made Grove read as an Astro theme.
                    label: 'Starlight theme',
                    collapsed: true,
                    items: [
                        { label: 'Overview', slug: 'starlight' },
                        { label: 'Plugin API', slug: 'starlight/plugin-api' },
                        { label: 'Plugin author guide', slug: 'starlight/plugin-author-guide' },
                        { label: 'Components', slug: 'starlight/components' },
                        { label: 'Typography', slug: 'starlight/typography' },
                        { label: 'Splash pages', slug: 'starlight/splash-pages' },
                        { label: 'Splash: banner', slug: 'starlight/splash/banner' },
                        { label: 'Splash: centered', slug: 'starlight/splash/centered' },
                        { label: 'Splash: centered-top', slug: 'starlight/splash/centered-top' },
                        { label: 'Splash: split-left', slug: 'starlight/splash/split-left' },
                        { label: 'Splash: split-right', slug: 'starlight/splash/split-right' },
                    ],
                },
                {
                    label: 'Project',
                    items: [
                        { label: 'Roadmap', slug: 'roadmap' },
                        { label: 'Built with Grove', slug: 'open-apps' },
                    ],
                },
                {
                    label: 'Maintainers',
                    collapsed: true,
                    items: [
                        { label: 'Contributing', slug: 'maintainers/contributing' },
                        { label: 'Governance', slug: 'maintainers/governance' },
                        { label: 'CI and quality', slug: 'maintainers/ci-quality' },
                        { label: 'Release process', slug: 'maintainers/release-process' },
                        { label: 'Security', slug: 'maintainers/security' },
                    ],
                },
            ],
        }),
    ],
});
