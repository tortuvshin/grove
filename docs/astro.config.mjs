// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from '@grove-dev/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://grove.dev',
    integrations: [
        starlight({
            // The custom landing page at "/" is a Starlight splash
            // content entry (src/content/docs/index.mdx). The deep
            // showcase gallery lives at /showcase/* (also from
            // src/content/docs/showcase/).
            title: 'Grove',
            description:
                'Grove is an open-source framework for building living, file-based community knowledge spaces.',
            logo: {
                replacesTitle: false,
                alt: 'Grove',
                dark: './src/assets/logo-dark.svg',
                light: './src/assets/logo-light.svg',
            },
            customCss: ['./src/styles/global.css'],
            editLink: {
                baseUrl: 'https://github.com/grove-dev/grove/edit/main/docs',
            },
            lastUpdated: true,
            plugins: [
                lucode({
                    docs: {
                        includeAiUtilities: true,
                    },
                    navLinks: [
                        { label: 'Docs', link: '/getting-started/create-a-space/' },
                        { label: 'Showcase', link: '/showcase/starlight-components/' },
                        { label: 'API', link: '/reference/cli/' },
                    ],
                }),
            ],
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/grove-dev/grove' },
            ],
            sidebar: [
                {
                    label: 'Start here',
                    items: [
                        { label: 'What is Grove?', slug: 'getting-started/what-is-grove' },
                        { label: 'Create a space', slug: 'getting-started/create-a-space' },
                        { label: 'Add your first record', slug: 'getting-started/add-your-first-record' },
                    ],
                },
                {
                    label: 'Concepts',
                    items: [
                        { label: 'Blueprints', slug: 'concepts/blueprints' },
                        { label: 'Philosophy', slug: 'concepts/philosophy' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'CLI', slug: 'reference/cli' },
                        { label: 'grove.config.ts', slug: 'reference/config' },
                        { label: 'Record schema', slug: 'reference/record-schema' },
                        { label: 'Plugin API', slug: 'reference/plugin-api' },
                        { label: 'Theme Components', slug: 'reference/components' },
                    ],
                },
                {
                    label: 'Adapters',
                    items: [
                        { label: 'Astro', slug: 'adapters/astro' },
                        { label: 'Next.js (roadmap)', slug: 'adapters/nextjs' },
                        { label: 'SvelteKit (roadmap)', slug: 'adapters/svelte' },
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        { label: 'Author a record', slug: 'guides/author-a-record' },
                        { label: 'Maintain health signals', slug: 'guides/maintain-health-signals' },
                        { label: 'Manage decisions', slug: 'guides/manage-decisions' },
                        { label: 'Sync GitHub metadata', slug: 'guides/sync-github-metadata' },
                        { label: 'Customize the Astro template', slug: 'guides/customize-astro-template' },
                        { label: 'Deploy', slug: 'guides/deploy' },
                    ],
                },
                {
                    label: 'Showcase',
                    items: [
                        { label: 'Splash pages', slug: 'showcase/splash-pages' },
                        { label: 'Starlight components', slug: 'showcase/starlight-components' },
                        { label: 'Typography', slug: 'showcase/typography' },
                    ],
                },
                {
                    label: 'Project',
                    items: [
                        { label: 'Roadmap', slug: 'roadmap' },
                    ],
                },
                {
                    label: 'Maintainers',
                    items: [
                        { label: 'Governance', slug: 'maintainers/governance' },
                        { label: 'Release process', slug: 'maintainers/release-process' },
                        { label: 'Contributing', slug: 'maintainers/contributing' },
                        { label: 'Security', slug: 'maintainers/security' },
                    ],
                },
            ],
        }),
    ],
});
