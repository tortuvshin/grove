// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

/**
 * Vite plugin that mocks `virtual:starlight/*` modules so we can import
 * Starlight's <Page> and <Header> components from custom Astro pages
 * (the landing at / and the showcase hub at /showcase) without going
 * through Starlight's routing. The mock is intentionally narrow — only
 * the bits <Page> needs at render time are populated.
 */
function starlightVirtualStubs() {
    const virtualModules = {
        'virtual:starlight/user-css': `export default {};`,
        'virtual:starlight/user-config': `
export default {
    title: 'Grove',
    description: 'Grove is an open-source framework for growing useful community knowledge.',
    logo: { replacesTitle: false, alt: 'Grove', src: '/src/assets/logo-light.svg' },
    components: {},
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/grove-dev/grove' }],
    credits: true,
    pagefind: true,
    lastUpdated: true,
    editLink: { baseUrl: 'https://github.com/grove-dev/grove/edit/main/docs' },
    locales: { root: { label: 'English', lang: 'en' } },
    defaultLocale: 'root',
    sidebar: [],
    nav: [],
    head: [],
    expressiveCode: {},
    markdown: { headingLinks: true },
    plugins: {},
    trailingSlash: 'ignore',
    disable404Route: false,
    prefersReducedMotion: false,
    customCss: [],
    componentsConfig: {},
};
`,
        'virtual:starlight/components/SiteTitle': `export { default } from '@astrojs/starlight/components/SiteTitle.astro';`,
        'virtual:starlight/components/SocialIcons': `export { default } from '@astrojs/starlight/components/SocialIcons.astro';`,
        'virtual:starlight/components/ThemeSelect': `export { default } from '@astrojs/starlight/components/ThemeSelect.astro';`,
        'virtual:starlight/components/Search': `export { default } from '@astrojs/starlight/components/Search.astro';`,
        'virtual:starlight/components/LanguageSelect': `export { default } from '@astrojs/starlight/components/LanguageSelect.astro';`,
        'virtual:starlight/components/Banner': `export { default } from '@astrojs/starlight/components/Banner.astro';`,
        'virtual:starlight/components/ContentPanel': `export { default } from '@astrojs/starlight/components/ContentPanel.astro';`,
        'virtual:starlight/components/FallbackContentNotice': `export { default } from '@astrojs/starlight/components/FallbackContentNotice.astro';`,
        'virtual:starlight/components/DraftContentNotice': `export { default } from '@astrojs/starlight/components/DraftContentNotice.astro';`,
        'virtual:starlight/components/Footer': `export { default } from '@astrojs/starlight/components/Footer.astro';`,
        'virtual:starlight/components/Head': `export { default } from '@astrojs/starlight/components/Head.astro';`,
        'virtual:starlight/components/Header': `export { default } from '@astrojs/starlight/components/Header.astro';`,
        'virtual:starlight/components/Hero': `export { default } from '@astrojs/starlight/components/Hero.astro';`,
        'virtual:starlight/components/MarkdownContent': `export { default } from '@astrojs/starlight/components/MarkdownContent.astro';`,
        'virtual:starlight/components/PageFrame': `export { default } from '@astrojs/starlight/components/PageFrame.astro';`,
        'virtual:starlight/components/PageSidebar': `export { default } from '@astrojs/starlight/components/PageSidebar.astro';`,
        'virtual:starlight/components/PageTitle': `export { default } from '@astrojs/starlight/components/PageTitle.astro';`,
        'virtual:starlight/components/Sidebar': `export { default } from '@astrojs/starlight/components/Sidebar.astro';`,
        'virtual:starlight/components/SkipLink': `export { default } from '@astrojs/starlight/components/SkipLink.astro';`,
        'virtual:starlight/components/ThemeProvider': `export { default } from '@astrojs/starlight/components/ThemeProvider.astro';`,
        'virtual:starlight/components/TwoColumnContent': `export { default } from '@astrojs/starlight/components/TwoColumnContent.astro';`,
        'virtual:starlight/optional-css': `export default [];`,
        'virtual:starlight/project-context': `export default { trailingSlash: 'ignore' };`,
        'virtual:starlight/user-images': `export const logos = { dark: null, light: null };`,
    };

    return {
        name: 'starlight-virtual-stubs',
        enforce: 'pre',
        resolveId(id) {
            if (id in virtualModules) return '\0' + id;
            return null;
        },
        load(id) {
            const stripped = id.startsWith('\0') ? id.slice(1) : id;
            if (stripped in virtualModules) return virtualModules[stripped];
            return null;
        },
    };
}

// https://astro.build/config
export default defineConfig({
    site: 'https://grove.dev',
    vite: {
        plugins: [starlightVirtualStubs()],
        ssr: {
            noExternal: ['@astrojs/starlight'],
        },
    },
    integrations: [
        starlight({
            // The custom landing page at "/" and showcase hub at "/showcase"
            // are plain Astro routes in src/pages/. The Starlight site keeps
            // the root and exposes its content at /start-here, /tutorials,
            // /guides, /reference, /showcase/* (deep gallery).
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
                        { label: 'What is Grove?', slug: 'start-here/what-is-grove' },
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
                        { label: 'Plugin API', slug: 'reference/plugin-api' },
                        { label: 'Theme Components', slug: 'reference/components' },
                    ],
                },
            ],
        }),
    ],
});
