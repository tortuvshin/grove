// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';
import tailwindcss from '@tailwindcss/vite';

// Grove docs — the canonical Astro/Starlight site for the project.
// This site is itself a Grove space: it uses the same record schema,
// Astro template, and CLI workflow as any user-built space.
export default defineConfig({
    site: 'https://grove.dev.mn',
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
                'Grove turns structured files into fast, searchable, contributor-friendly community knowledge spaces.',
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
                { tag: 'meta', attrs: { property: 'og:image', content: 'https://grove.dev.mn/og-image.svg' } },
                { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://grove.dev.mn/og-image.svg' } },
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
                        url: 'https://grove.dev.mn',
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
                    label: 'Getting Started',
                    items: [
                        // Introduction was moved to /introduction/ and linked
                        // from the home header — the remaining three items
                        // stay under the Getting Started sidebar.
                        { label: 'Create a project directory', slug: 'getting-started/create-a-space' },
                        { label: 'Add your first project', slug: 'getting-started/add-your-first-project' },
                        { label: 'Deploy your site', slug: 'getting-started/deploy' },
                    ],
                },
                {
                    label: 'Build your directory',
                    items: [
                        { label: 'Configure your space', slug: 'build/configure' },
                        { label: 'Projects', slug: 'build/projects' },
                        { label: 'Categories and tags', slug: 'build/taxonomy' },
                        { label: 'Pages and content', slug: 'build/pages' },
                        { label: 'Images and assets', slug: 'build/assets' },
                    ],
                },
                {
                    label: 'Customize',
                    items: [
                        { label: 'Branding', slug: 'customize/branding' },
                        { label: 'Theme', slug: 'customize/theme' },
                        { label: 'Components', slug: 'customize/components' },
                        { label: 'Custom pages', slug: 'customize/pages' },
                    ],
                },
                {
                    label: 'Automation',
                    items: [
                        { label: 'GitHub metadata', slug: 'automation/github-metadata' },
                        { label: 'Community submissions', slug: 'automation/submissions' },
                        { label: 'Validation', slug: 'automation/validation' },
                        { label: 'Scheduled maintenance', slug: 'automation/scheduled' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'Configuration', slug: 'reference/config' },
                        { label: 'Project record', slug: 'reference/record-schema' },
                        { label: 'CLI', slug: 'reference/cli' },
                        { label: 'Astro components', slug: 'reference/components' },
                    ],
                },
                {
                    label: 'Project',
                    items: [
                        { label: 'Framework status', slug: 'reference/frameworks' },
                        { label: 'Roadmap', slug: 'roadmap' },
                        { label: 'Maintainers', slug: 'maintainers/contributing' },
                    ],
                },
            ],
        }),
    ],
});
