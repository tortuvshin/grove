import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { splitFrontmatter } from './content-body.js';
import { yamlRecordToMarkdown } from './record-markdown.js';

const RECORD = [
  'kind: project',
  'slug: demo',
  'addedAt: 2026-08-11',
  'description: A long description that the author wrapped by hand across',
  '  two lines of YAML.',
  'content: ./content/records/demo.md',
  'curation:',
  '  reviewed: true',
  '# Why this is listed, in the curator’s words.',
  'whyListed:',
  '  - Reason',
  'category: tools',
  'links:',
  '  website: https://demo.example',
  '  github: https://github.com/owner/demo',
  'name: Demo',
  'repoUrl: https://github.com/owner/demo',
  'customField: kept',
  'visibility: keep',
  '',
].join('\n');

const BODY = '## Review\n\nBody text, kept byte-for-byte.\n';

describe('yamlRecordToMarkdown', () => {
  it('writes the fields in a stable order, keeping each field’s own text', () => {
    const result = yamlRecordToMarkdown('demo', RECORD, { kind: 'project', body: BODY });
    expect(result).toEqual({
      ok: true,
      dropped: ['content', 'slug', 'kind'],
      text: [
        '---',
        'name: Demo',
        'repoUrl: https://github.com/owner/demo',
        'category: tools',
        'description: A long description that the author wrapped by hand across',
        '  two lines of YAML.',
        // Nested order is the author's: `website` stays before `github`.
        'links:',
        '  website: https://demo.example',
        '  github: https://github.com/owner/demo',
        '# Why this is listed, in the curator’s words.',
        'whyListed:',
        '  - Reason',
        'addedAt: 2026-08-11',
        // Unknown fields sit between the contributor and reviewer fields.
        'customField: kept',
        'curation:',
        '  reviewed: true',
        'visibility: keep',
        '---',
        '## Review',
        '',
        'Body text, kept byte-for-byte.',
        '',
      ].join('\n'),
    });
  });

  it('reads back as the same fields and the same body', () => {
    const result = yamlRecordToMarkdown('demo', RECORD, { kind: 'project', body: BODY });
    if (!result.ok) throw new Error(result.reason);
    const { frontmatter, body } = splitFrontmatter(result.text);
    const { content, slug, kind, ...expected } = parseYaml(RECORD, { schema: 'core' });
    expect(parseYaml(frontmatter, { schema: 'core' })).toEqual(expected);
    expect(body).toBe(BODY);
  });

  it('writes frontmatter and an empty body for a record without one', () => {
    const result = yamlRecordToMarkdown('plain', 'name: Plain\ncategory: tools\n');
    expect(result).toEqual({
      ok: true,
      dropped: [],
      text: '---\nname: Plain\ncategory: tools\n---\n',
    });
  });

  it('keeps a slug that differs from the file name and a kind the blueprint does not give', () => {
    const result = yamlRecordToMarkdown('file-name', 'kind: entity\nslug: other\nname: X\n', {
      kind: 'project',
    });
    expect(result).toMatchObject({ ok: true, dropped: [] });
  });

  it('refuses inline github/health, a missing label and a non-mapping', () => {
    expect(yamlRecordToMarkdown('a', 'name: A\nhealth:\n  status: active\n')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('grove migrate github-cache'),
    });
    expect(yamlRecordToMarkdown('a', 'name: A\n', { labelKey: 'title' })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('`title`'),
    });
    expect(yamlRecordToMarkdown('a', '- a\n- b\n')).toMatchObject({ ok: false });
  });

  it('refuses a record that would not read back, rather than write it', () => {
    // A `---` line inside a block scalar would close the frontmatter early.
    const yaml = 'name: A\nnotes: |\n  before\n  ---\n  after\n';
    expect(yamlRecordToMarkdown('a', yaml)).toMatchObject({ ok: false });
    // The loader looks for the closing fence in the first 200 lines only.
    const long = `name: A\ntags:\n${Array.from({ length: 250 }, (_, i) => `  - t${i}`).join('\n')}\n`;
    expect(yamlRecordToMarkdown('a', long)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('would not read back'),
    });
  });

  it('falls back to the YAML document model when the text cannot be cut by lines', () => {
    const result = yamlRecordToMarkdown('flow', '{ category: tools, name: Flow }\n');
    expect(result).toEqual({
      ok: true,
      dropped: [],
      text: '---\nname: Flow\ncategory: tools\n---\n',
    });
  });
});
