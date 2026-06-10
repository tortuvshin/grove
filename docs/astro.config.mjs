// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'Grove',
            logo: {
                replacesTitle: false,
                alt: 'Grove',
                dark: './src/assets/logo-dark.svg',
                light: './src/assets/logo-light.svg',
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/grove-dev/grove' },
            ],
            plugins: [
                grove({
                    footerText:
                        'Built by [grove](https://github.com/grove-dev). Released under the MIT License.',
                }),
            ],
            sidebar: [
                {
                    label: 'Guides',
                    items: [{ label: 'Getting Started', slug: 'guides/example' }],
                },
                {
                    label: 'Reference',
                    items: [{ autogenerate: { directory: 'reference' } }],
                },
            ],
        }),
    ],
});
