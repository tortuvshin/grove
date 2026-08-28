// The Starlight sidebar, extracted to plain data so it is shared between
// astro.config.mjs and the llms.txt endpoint (which groups pages by these
// sections). Sections are ordered by reader intent: understand it, build
// with it, automate it, ship it, then look things up. Sidebar groups are
// decoupled from file paths (Starlight resolves items by `slug`), so
// regrouping here never changes a URL.
export const SIDEBAR = [
    {
        label: 'Start here',
        items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Quickstart', slug: 'start-here/quickstart' },
            { label: 'Why Grove', slug: 'start-here/why-grove' },
            { label: 'Files are canonical', slug: 'concepts/files-canonical' },
            { label: 'UI registry and consumer-owned source', slug: 'concepts/registry' },
        ],
    },
    {
        // 16 how-to pages would be unreadable as a flat list, so
        // they are grouped by the job the reader is doing.
        label: 'Guides',
        items: [
            {
                label: 'Set up',
                items: [
                    { label: 'Install the CLI', slug: 'getting-started/install-cli' },
                    { label: 'Scaffold a space', slug: 'getting-started/scaffold' },
                    { label: 'Configure your space', slug: 'getting-started/configure' },
                ],
            },
            {
                label: 'Author',
                items: [
                    { label: 'Author your first record', slug: 'getting-started/first-record' },
                    { label: 'Add a record', slug: 'content/author-a-record' },
                    { label: 'Organize with taxonomy', slug: 'content/taxonomy-files' },
                    { label: 'Add content pages', slug: 'concepts/content-pages' },
                ],
            },
            {
                label: 'Curate',
                items: [
                    { label: 'Curate with decisions', slug: 'concepts/decisions' },
                    { label: 'Build collections', slug: 'concepts/collections' },
                    { label: 'Walkthrough: curate a collection', slug: 'guides/walkthrough-curate-collection' },
                    { label: 'Triage health signals', slug: 'content/health-classification' },
                    { label: 'Browse pages', slug: 'discovery/browse' },
                    { label: 'Lens recipes', slug: 'discovery/lens-recipes' },
                    { label: 'Promote a filter to a collection', slug: 'discovery/promote' },
                ],
            },
            {
                // These two read as framework-contributor docs
                // because of their `maintainers/` path, but both
                // are written for the person running a Grove-powered
                // directory — a reader, not a Grove contributor.
                label: 'Run your directory',
                items: [
                    { label: 'Contributing', slug: 'maintainers/contributing' },
                    { label: 'Governance', slug: 'maintainers/governance' },
                ],
            },
        ],
    },
    {
        label: 'Automation',
        items: [
            { label: 'grove check', slug: 'automation/check' },
            { label: 'Sync GitHub metadata', slug: 'automation/sync-github' },
            { label: 'Walkthrough: sync GitHub', slug: 'guides/walkthrough-sync-github' },
            { label: 'Sync contributors', slug: 'automation/sync-contributors' },
            { label: 'Scheduled workflows', slug: 'automation/scheduled' },
            { label: 'Cleanup report', slug: 'automation/cleanup' },
            { label: 'Audit', slug: 'automation/audit' },
            { label: 'Generate README', slug: 'automation/readme' },
            { label: 'Community submissions', slug: 'automation/submissions' },
            { label: 'GitHub workflows', slug: 'outputs/workflows' },
        ],
    },
    {
        label: 'Deploy',
        items: [
            { label: 'Deploy your site', slug: 'deployment/overview' },
            { label: 'Static deployment', slug: 'concepts/static-deployment' },
            { label: 'GitHub Pages', slug: 'deployment/github-pages' },
            { label: 'Cloudflare', slug: 'deployment/cloudflare' },
            { label: 'Netlify', slug: 'deployment/netlify' },
            { label: 'Self-hosted', slug: 'deployment/self-hosted' },
        ],
    },
    {
        label: 'Customization',
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
        // Grove's core promise is one source producing many
        // outputs, so these get their own section rather than
        // being buried at the bottom of Reference.
        label: 'Outputs',
        items: [
            { label: 'Files & outputs', slug: 'outputs/overview' },
            { label: 'LLM & AI surfaces', slug: 'outputs/llm' },
            { label: 'SEO & social', slug: 'outputs/seo' },
            { label: 'Site metadata', slug: 'outputs/site-meta' },
            { label: 'Generated data files', slug: 'outputs/generated-data' },
        ],
    },
    {
        label: 'Reference',
        items: [
            { label: 'grove.config.ts', slug: 'reference/config' },
            { label: 'Record schema', slug: 'reference/record-schema' },
            { label: 'CLI reference', slug: 'reference/cli' },
            { label: 'Astro components', slug: 'reference/components' },
            { label: 'Migration guide', slug: 'reference/migration' },
            { label: 'Glossary', slug: 'start-here/glossary' },
        ],
    },
    {
        label: 'Extend',
        collapsed: true,
        items: [
            { label: 'Programmatic API', slug: 'reference/api-core' },
            { label: 'Plugin API', slug: 'reference/plugin-api' },
            { label: 'Plugin author guide', slug: 'reference/plugin-author-guide' },
        ],
    },
    {
        // Grove's own engineering process — for people working on
        // the framework, not on a site built with it. Roadmap and
        // FAQ are reachable from the top nav instead.
        label: 'Project',
        collapsed: true,
        items: [
            { label: 'Architecture', slug: 'project/architecture' },
            { label: 'CI & quality', slug: 'maintainers/ci-quality' },
            { label: 'Release process', slug: 'maintainers/release-process' },
            { label: 'Security', slug: 'maintainers/security' },
        ],
    },
];
