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
    a: 'V1 ships the Astro adapter only. The core engine is framework-agnostic (typed schema, GitHub sync, importers, sitemap, llms.txt), so a SvelteKit or Next.js adapter is possible. V1.1 is planned for SvelteKit; see the roadmap for current status.',
  },
  {
    q: 'How is this different from an awesome-list README?',
    a: 'An awesome-list is a flat Markdown list with no schema, no review state, no live metadata, and no static discovery surface. Grove adds a typed record model, scheduled GitHub metadata sync, health classification, search and filters, llms.txt for AI ingestion, and a PR-based submission workflow — without giving up the portability of files.',
  },
  {
    q: 'Where do I host the site?',
    a: 'Anywhere that serves static HTML. GitHub Pages, Cloudflare Pages, Netlify, and Vercel all work out of the box. There is no server runtime, so there is no database to back up and no API keys to manage at request time.',
  },
  {
    q: "What happens when a record's repo is archived?",
    a: "grove sync github reads the archived flag and writes it into the record's github block. The Astro template renders an Archived badge in the activity pill and a status row in the sidebar. The record stays visible by default — removing or hiding it is a curator's call, recorded in decisions.yml.",
  },
  {
    q: 'Can I import an existing awesome-list?',
    a: 'Yes. grove import <github-url> parses the README, infers a record per entry, and writes them under data/records/. Each imported record gets source: { type: "import" } so curators can filter and finish them later.',
  },
];
