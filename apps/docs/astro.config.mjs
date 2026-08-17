// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';
import tailwindcss from '@tailwindcss/vite';

// Grove docs — the canonical Astro/Starlight site for the project.
// This site is itself a Grove space: it uses the same record schema,
// Astro template, and CLI workflow as any user-built space.
export default defineConfig({
    site: 'https://withgrove.dev',
    // Astro's built-in redirects (added in Astro 5). Starlight 0.41 does
    // not recognize a `redirects` key on its own config — these are emitted
    // by Astro at build time and served as 301s by the static host.
    redirects: {
        '/concepts/philosophy/':            '/start-here/why-grove/',
        '/concepts/records/':               '/content/author-a-record/',
        '/concepts/taxonomy/':              '/content/taxonomy-files/',
        '/concepts/health/':                '/content/health-classification/',
        '/blueprints/project-directory/':   '/concepts/blueprints/',
        '/blueprints/resource-hub/':        '/concepts/blueprints/',
        '/blueprints/ecosystem-map/':       '/concepts/blueprints/',
        '/sources/records/':                '/content/author-a-record/',
        '/sources/taxonomy-files/':         '/content/taxonomy-files/',
        '/sources/collections/':            '/concepts/collections/',
        '/sources/decisions/':              '/concepts/decisions/',
        '/sources/content-pages/':          '/concepts/content-pages/',
        '/sources/health-classification/':  '/content/health-classification/',
        '/content/decisions/':              '/concepts/decisions/',
        '/content/collections/':            '/concepts/collections/',
        '/content/pages/':                  '/concepts/content-pages/',
        '/getting-started/deploy/':         '/deployment/overview/',
        '/automation/validation/':          '/automation/check/',
        '/automation/github-metadata/':     '/automation/sync-github/',
        '/getting-started/create-a-space/': '/getting-started/scaffold/',
        '/getting-started/add-your-first-project/': '/getting-started/first-record/',
        '/roadmap/':                        '/project/roadmap/',
        '/faq/':                            '/project/faq/',
        '/architecture/incremental-build/': '/project/architecture/',
        '/showcase/splash-pages/':          '/customize/template-customization/',
        '/showcase/splash/banner/':         '/customize/template-customization/',
        '/showcase/splash/centered/':       '/customize/template-customization/',
        '/showcase/splash/centered-top/':   '/customize/template-customization/',
        '/showcase/splash/split-left/':     '/customize/template-customization/',
        '/showcase/splash/split-right/':    '/customize/template-customization/',
        '/showcase/typography/':            '/customize/template-customization/',
        '/showcase/starlight-components/':  '/reference/components/',
        '/open-apps/':                      '/start-here/why-grove/',
        '/reference/frameworks/':           '/project/architecture/',
    },
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
                {
                    label: 'Start here',
                    items: [
                        { label: 'Introduction', slug: 'introduction' },
                        { label: 'Quickstart', slug: 'start-here/quickstart' },
                        { label: 'Mental model', slug: 'start-here/mental-model' },
                        { label: 'Why Grove', slug: 'start-here/why-grove' },
                        { label: 'Glossary', slug: 'start-here/glossary' },
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        { label: 'Scaffold a space', slug: 'getting-started/scaffold' },
                        { label: 'Install the CLI', slug: 'getting-started/install-cli' },
                        { label: 'Author your first record', slug: 'getting-started/first-record' },
                        { label: 'Add a record', slug: 'content/author-a-record' },
                        { label: 'Organize with taxonomy', slug: 'content/taxonomy-files' },
                        { label: 'Curate with decisions', slug: 'concepts/decisions' },
                        { label: 'Build collections', slug: 'concepts/collections' },
                        { label: 'Add content pages', slug: 'concepts/content-pages' },
                        { label: 'Triage health signals', slug: 'content/health-classification' },
                        { label: 'Configure your space', slug: 'getting-started/configure' },
                        { label: 'Deploy your site', slug: 'deployment/overview' },
                        { label: 'GitHub Pages', slug: 'deployment/github-pages' },
                        { label: 'Cloudflare', slug: 'deployment/cloudflare' },
                        { label: 'Netlify', slug: 'deployment/netlify' },
                        { label: 'Self-hosted', slug: 'deployment/self-hosted' },
                        { label: 'Three blueprints', slug: 'concepts/blueprints' },
                        { label: 'Files are canonical', slug: 'concepts/files-canonical' },
                        { label: 'Static deployment', slug: 'concepts/static-deployment' },
                    ],
                },
                {
                    label: 'Walkthroughs',
                    collapsed: true,
                    items: [
                        { label: 'Add your first record', slug: 'guides/walkthrough-add-record' },
                        { label: 'Curate a collection', slug: 'guides/walkthrough-curate-collection' },
                        { label: 'Sync GitHub metadata', slug: 'guides/walkthrough-sync-github' },
                    ],
                },
                {
                    label: 'Customize',
                    items: [
                        { label: 'Theme tokens', slug: 'customize/theme' },
                        { label: 'Branding', slug: 'customize/branding' },
                        { label: 'Components', slug: 'customize/components' },
                        { label: 'Custom pages', slug: 'customize/pages' },
                        { label: 'Template customization', slug: 'customize/template-customization' },
                        { label: 'Assets', slug: 'customize/assets' },
                        { label: 'Icons', slug: 'customize/icons' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'grove.config.ts', slug: 'reference/config' },
                        { label: 'Record schema', slug: 'reference/record-schema' },
                        { label: 'CLI reference', slug: 'reference/cli' },
                        { label: 'Astro components', slug: 'reference/components' },
                        { label: 'Files & outputs', slug: 'outputs/overview' },
                        { label: 'LLM & AI surfaces', slug: 'outputs/llm' },
                        { label: 'SEO & social', slug: 'outputs/seo' },
                        { label: 'Site metadata', slug: 'outputs/site-meta' },
                        { label: 'Generated data files', slug: 'outputs/generated-data' },
                        { label: 'GitHub workflows', slug: 'outputs/workflows' },
                    ],
                },
                {
                    label: 'Advanced',
                    collapsed: true,
                    items: [
                        { label: 'Sync GitHub metadata', slug: 'automation/sync-github' },
                        { label: 'Sync GitHub deep-dive', slug: 'automation/sync-github-deep-dive' },
                        { label: 'Sync contributors', slug: 'automation/sync-contributors' },
                        { label: 'Scheduled workflows', slug: 'automation/scheduled' },
                        { label: 'Cleanup report', slug: 'automation/cleanup' },
                        { label: 'Audit', slug: 'automation/audit' },
                        { label: 'Generate README', slug: 'automation/readme' },
                        { label: 'Community submissions', slug: 'automation/submissions' },
                        { label: 'grove check', slug: 'automation/check' },
                        { label: 'Browse pages', slug: 'discovery/browse' },
                        { label: 'Lens recipes', slug: 'discovery/lens-recipes' },
                        { label: 'Promote a filter to a collection', slug: 'discovery/promote' },
                        { label: 'Programmatic API', slug: 'reference/api-core' },
                        { label: 'Plugin API', slug: 'reference/plugin-api' },
                        { label: 'Plugin author guide', slug: 'reference/plugin-author-guide' },
                        { label: 'Migration guide', slug: 'reference/migration' },
                        { label: 'Contributing as a reviewer', slug: 'maintainers/contributing' },
                        { label: 'Governance', slug: 'maintainers/governance' },
                        { label: 'CI & quality', slug: 'maintainers/ci-quality' },
                        { label: 'Release process', slug: 'maintainers/release-process' },
                        { label: 'Security', slug: 'maintainers/security' },
                    ],
                },
                {
                    label: 'Resources',
                    items: [
                        { label: 'Roadmap', slug: 'project/roadmap' },
                        { label: 'FAQ', slug: 'project/faq' },
                        { label: 'Architecture', slug: 'project/architecture' },
                    ],
                },
            ],
        }),
    ],
});
