/**
 * FAQ entries surfaced on the Grove marketing landing page.
 *
 * Single source of truth — both the visible `<Faq>` component and the
 * `FAQPage` JSON-LD payload (`HomeLayout.astro`) import this array
 * so the two surfaces can never drift.
 */

export interface FaqItem {
  /** Question text. Shown as the `<summary>` and as `name` on the
   *  schema.org `Question` node. */
  q: string;
  /** Answer text. Rendered in the collapsible body and as `text`
   *  on the schema.org `Answer` node. */
  a: string;
}

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    q: 'Is Grove a CMS?',
    a: 'No. Grove is a build-time framework. Your content lives as YAML files in your repository, not in a database. There is no admin UI to maintain — editors open pull requests like any other code change, and the framework generates the static site on every merge.',
  },
  {
    q: 'Does it work without Astro?',
    a: 'Astro is the only renderer that exists today. The core engine is framework-agnostic — typed schema, source sync, importers, sitemap, llms.txt — so a renderer for another framework is possible, but none is scaffolded: `@grove-dev/svelte` and `@grove-dev/nextjs` have never been published. The [roadmap](/roadmap/) tracks where that stands.',
  },
  {
    q: 'How is this different from a Markdown list in a README?',
    a: 'A hand-kept list has no schema, no review state, no refreshed facts, and nothing a machine can read. Grove adds a typed record model, scheduled metadata sync, staleness classification, search and filters, llms.txt for AI ingestion, and a PR-based submission workflow — without giving up the portability of plain files.',
  },
  {
    q: 'Where do I host the site?',
    a: 'Anywhere that serves static HTML. GitHub Pages, Cloudflare Pages, Netlify, and Vercel all work out of the box. There is no server runtime, so there is no database to back up and no API keys to manage at request time.',
  },
  {
    q: 'What happens when an entry goes stale?',
    a: "grove sync github reads the upstream state — including whether a repository was archived — and writes it into the record. The Astro template renders the status in the activity pill and a row in the sidebar, and the entry stays visible by default. Removing or hiding it is a curator's call, recorded in decisions.yml.",
  },
  {
    q: 'Can I import a list I already maintain?',
    a: 'Yes. grove import <github-url> parses the README, infers a record per entry, and writes them under data/records/. Each imported record gets source: { type: "import" } so curators can filter and finish them later.',
  },
];
