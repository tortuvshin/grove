import { defineConfig } from '@grove-dev/core';

/** The demo is an AI directory only because this config and its data say so. */
export default defineConfig({
  blueprint: 'project-directory',

  site: {
    name: 'Grove AI Directory',
    tagline: 'Open-source AI tools worth running, studying, and extending.',
    description:
      'A curated directory of open-source AI tools, agents, and infrastructure powered by Grove.',
    url: 'https://example.com',
    repoUrl: 'https://github.com/tortuvshin/grove',
  },

  nav: [
    { label: 'Home', href: '/' },
    { label: 'Browse', href: '/projects' },
    { label: 'Collections', href: '/collections' },
    { label: 'About', href: '/about' },
  ],

  footer: {
    columns: [
      {
        heading: 'Discover',
        items: [
          { label: 'Browse projects', href: '/projects' },
          { label: 'Contributors', href: '/contributors' },
        ],
      },
      {
        heading: 'Contribute',
        items: [
          { label: 'Submit a project', href: '/submit' },
          {
            label: 'Report an issue',
            href: 'https://github.com/tortuvshin/grove/issues',
            external: true,
          },
        ],
      },
      {
        heading: 'Project',
        items: [
          {
            label: 'Source on GitHub',
            href: 'https://github.com/tortuvshin/grove',
            external: true,
          },
          { label: 'About', href: '/about' },
        ],
      },
    ],
    license: 'Directory content is community curated.',
  },

  submission: {
    eyebrow: 'AI project submission',
    title: 'Add an open-source AI project',
    description:
      'Generate a Grove record from a public GitHub repository, review the AI taxonomy, then open a pull request.',
    good: [
      'A usable open-source AI tool, agent framework, interface, or infrastructure project',
      'A public repository with a clear license and enough documentation to evaluate',
      "A category, stack, and tags chosen from this directory's taxonomy",
    ],
    avoid: [
      'Closed-source AI products or marketing-only landing pages',
      'Prompt collections, tutorials, snippets, or duplicate entries',
      'Abandoned experiments without documentation or a verifiable license',
    ],
  },

  // Which browse dimensions the site exposes, in filter-group order.
  // `license` is enabled so the license taxonomy pages, the browse
  // filter, and the search placeholder stay consistent.
  browse: {
    facets: ['category', 'stack', 'platform', 'tags', 'license'],
  },

  // The scheduled sync workflows (.github/workflows/sync-*.yml) honor
  // these flags — disable a sub-feature here to turn its sync into a no-op.
  integrations: { github: { metadata: true, contributors: true, health: true } },

  theme: {
    radius: 'soft',
    density: 'comfortable',
    containerWidth: '72rem',
  },

  audit: {
    baseUrl: 'http://127.0.0.1:4321',
    pages: [
      { path: '/', type: 'home', label: 'Homepage' },
      { path: '/projects/', type: 'directory', label: 'Directory index' },
      {
        path: '/collections/top-ai-agents/',
        type: 'collection',
        label: 'Top AI Agents collection',
      },
      { path: '/projects/open-webui/', type: 'record', label: 'Record detail' },
      { path: '/about/', type: 'content', label: 'About page' },
      { path: '/empty/', type: 'empty', label: 'Empty state' },
      { path: '/this-page-does-not-exist/', type: '404', label: '404 page' },
    ],
  },

  readme: {
    title: 'Awesome Open-Source AI Tools',
    tagline: 'Hand-picked tools worth running, studying, and extending.',
    url: 'https://example.com',
    browseLabel: 'Browse the catalog →',
    intro: [
      '## Why this list',
      '',
      'Each tool below is **actively maintained**, **well documented**, and',
      '**useful in production**. Submit a new entry via `pnpm exec grove`',
      'or by opening a pull request against `data/records/`.',
    ].join('\n'),
  },
});
