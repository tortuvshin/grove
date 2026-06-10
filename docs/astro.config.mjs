// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import grove from '@grove-dev/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Grove Docs',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/grove-dev/grove' },
			],
			plugins: [grove()],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Getting Started', slug: 'guides/example' },
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
	],
});
