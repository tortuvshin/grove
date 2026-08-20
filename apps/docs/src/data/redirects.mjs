// Legacy URL -> current URL map for the docs site. Single source of truth:
// astro.config.mjs feeds it to Astro's `redirects` (meta-refresh stub pages,
// the fallback for local preview and non-Cloudflare hosts) AND to the inline
// integration that writes dist/_redirects so Cloudflare serves real 301s.
export const REDIRECTS = {
    '/concepts/philosophy/':            '/start-here/why-grove/',
    // Mental model was folded into the files-are-canonical page, which
    // now carries the full three-tier breakdown.
    '/start-here/mental-model/':        '/concepts/files-canonical/',
    '/concepts/records/':               '/content/author-a-record/',
    '/concepts/taxonomy/':              '/content/taxonomy-files/',
    '/concepts/health/':                '/content/health-classification/',
    // The "three blueprints" page was retired: only `project-directory`
    // is supported today, so the docs no longer teach the other two.
    // These legacy URLs now land on the schema reference, which states
    // the `kind` each blueprint accepts without promoting the feature.
    '/blueprints/project-directory/':   '/reference/record-schema/',
    '/blueprints/resource-hub/':        '/reference/record-schema/',
    '/blueprints/ecosystem-map/':       '/reference/record-schema/',
    '/concepts/blueprints/':            '/reference/record-schema/',
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
    // Both pages were merged into their canonical counterparts: the
    // add-a-record walkthrough only re-narrated scaffold + first-record,
    // and the sync deep-dive shared a title and most of its content with
    // the main sync page.
    '/guides/walkthrough-add-record/':   '/getting-started/first-record/',
    '/automation/sync-github-deep-dive/': '/automation/sync-github/',
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
};
