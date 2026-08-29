import { describe, expect, it } from 'vitest';
import { buildLlmsFullTxt, buildLlmsTxt } from './llms.js';
import type { GroveConfig } from './schema.js';

const config = {
  blueprint: 'project-directory',
  site: {
    name: 'Open Apps',
    tagline: 'Open-source apps with real codebases.',
    url: 'https://openappscout.com',
  },
  routes: { directory: 'apps' },
  labels: { singular: 'app', plural: 'apps' },
} as GroveConfig;

const input = {
  generatedAt: '2026-06-24T00:00:00.000Z',
  records: [
    {
      slug: 'immich',
      name: 'Immich',
      description: 'Self-hosted photo backup.',
      category: 'tools',
      stack: 'flutter',
    },
  ],
};

describe('LLM outputs', () => {
  it('uses the configured directory route in the compact index', () => {
    const text = buildLlmsTxt(input, config);

    expect(text).toContain('Directory: https://openappscout.com/apps');
    expect(text).not.toContain('/projects');
  });

  it('uses configured route and plural label in the full index', () => {
    const text = buildLlmsFullTxt(input, config);

    expect(text).toContain('> Source: https://openappscout.com/apps');
    expect(text).toContain('## Apps');
    expect(text).toContain('- url: https://openappscout.com/apps/immich');
    expect(text).not.toContain('/projects');
  });
});

describe('buildLlmsFullTxt catalog export', () => {
  it('includes full record summaries and taxonomy descriptions', () => {
    const out = buildLlmsFullTxt({
      site: {
        name: 'Example',
        url: 'https://example.com/',
        description: 'Full catalog',
      },
      records: [
        {
          url: 'https://example.com/apps/a/',
          title: 'App A',
          description: 'Top app',
          stack: 'TypeScript',
          license: 'MIT',
        },
      ],
      taxonomies: [
        {
          url: 'https://example.com/stacks/flutter/',
          title: 'Flutter',
          description: 'Flutter stack',
        },
      ],
      updatedAt: '2026-07-24T00:00:00Z',
    });

    expect(out).toContain('Updated: 2026-07-24');
    expect(out).toContain('### Flutter');
    expect(out).toContain('App A');
    expect(out).toContain('License: MIT');
  });
});
