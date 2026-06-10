// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    site: 'https://grove.dev',
    integrations: [
        starlight({
            title: 'Grove',
            description:
                'Grove is an open-source framework for growing useful community knowledge — collect, structure, maintain, and improve the projects, tools, resources, and knowledge a community relies on.',
            logo: {
                replacesTitle: false,
                alt: 'Grove',
                dark: './src/assets/logo-dark.svg',
                light: './src/assets/logo-light.svg',
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/grove-dev/grove' },
            ],
            sidebar: [
                {
                    label: 'Start here',
                    items: [
                        { label: 'What is Grove?', slug: 'index' },
                    ],
                },
                {
                    label: 'Tutorials',
                    items: [
                        { label: '1. Bootstrap a space', slug: 'tutorials/01-bootstrap' },
                        { label: '2. Author records', slug: 'tutorials/02-author-records' },
                        { label: '3. Customize the look', slug: 'tutorials/03-customize' },
                        { label: '4. Maintain the space', slug: 'tutorials/04-maintain' },
                        { label: '5. Deploy', slug: 'tutorials/05-deploy' },
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        { label: 'Spaces & blueprints', slug: 'guides/spaces' },
                        { label: 'The data model', slug: 'guides/data-model' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'CLI', slug: 'reference/cli' },
                        { label: 'grove.config.ts', slug: 'reference/config' },
                        { label: 'Resource schema', slug: 'reference/schema' },
                    ],
                },
            ],
        }),
    ],
});
