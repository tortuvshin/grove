// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from '@grove-dev/starlight';

// Grove docs — the canonical Astro/Starlight site for the project.
// This site is itself a Grove space: it uses the same record schema,
// Astro template, and CLI workflow as any user-built space.
export default defineConfig({
    site: 'https://grove.dev',
    integrations: [
        starlight({
            // The custom landing page at "/" is the product landing page
            // (src/content/docs/index.mdx). The Open Apps case study lives
            // at /open-apps/. The deep docs/sidebar lives under
            // /getting-started/, /build/, /customize/, /automation/,
            // /reference/, /project/.
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
            plugins: [
                lucode({
                    docs: {
                        includeAiUtilities: true,
                    },
                    navLinks: [
                        { label: 'Open Apps', link: '/open-apps/' },
                        { label: 'Docs', link: '/getting-started/introduction/' },
                        { label: 'Roadmap', link: '/roadmap' },
                        { label: 'GitHub', link: 'https://github.com/tortuvshin/grove', attrs: { target: '_blank', rel: 'noopener noreferrer' } },
                    ],
                }),
            ],
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/tortuvshin/grove' },
            ],
            sidebar: [
                {
                    label: 'Getting Started',
                    items: [
                        { label: 'Introduction', slug: 'getting-started/introduction' },
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
