// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

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
                        { label: 'Docs', link: '/tutorials/01-bootstrap/' },
                        { label: 'Showcase', link: '/showcase/starlight-components/' },
                        { label: 'API', link: '/reference/plugin-api/' },
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
                    label: 'Showcase',
                    items: [
                        { label: 'Starlight Components', slug: 'showcase/starlight-components' },
                        { label: 'Splash Pages', slug: 'showcase/splash-pages' },
                        { label: 'Typography', slug: 'showcase/typography' },
                    ],
                },
                {
                    label: 'Splash Examples',
                    items: [
                        { label: 'Centered', slug: 'showcase/splash/centered' },
                        { label: 'Centered Top', slug: 'showcase/splash/centered-top' },
                        { label: 'Split Left', slug: 'showcase/splash/split-left' },
                        { label: 'Split Right', slug: 'showcase/splash/split-right' },
                        { label: 'Banner', slug: 'showcase/splash/banner' },
                    ],
                },
                {
                    label: 'Reference',
                    items: [
                        { label: 'CLI', slug: 'reference/cli' },
                        { label: 'grove.config.ts', slug: 'reference/config' },
                        { label: 'Resource schema', slug: 'reference/schema' },
                        { label: 'Plugin API', slug: 'reference/plugin-api' },
                        { label: 'Theme Components', slug: 'reference/components' },
                    ],
                },
            ],
        }),
    ],
});
