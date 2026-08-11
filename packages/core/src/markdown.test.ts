import { describe, expect, it } from 'vitest';
import {
  detectGithubRepo,
  extractDescription,
  parseAwesomeMarkdown,
  type ImportedRecord,
} from './markdown.js';

describe('detectGithubRepo', () => {
  it('matches canonical repo URLs', () => {
    expect(detectGithubRepo('https://github.com/owner/name')).toBe('https://github.com/owner/name');
  });

  it('strips .git suffix', () => {
    expect(detectGithubRepo('https://github.com/owner/name.git')).toBe(
      'https://github.com/owner/name',
    );
  });

  it('ignores query strings and fragments', () => {
    expect(detectGithubRepo('https://github.com/owner/name#readme')).toBe(
      'https://github.com/owner/name',
    );
    expect(detectGithubRepo('https://github.com/owner/name?tab=readme')).toBe(
      'https://github.com/owner/name',
    );
  });

  it('returns undefined for non-github URLs', () => {
    expect(detectGithubRepo('https://gitlab.com/owner/name')).toBeUndefined();
    expect(detectGithubRepo('https://example.com')).toBeUndefined();
  });

  it('returns undefined for reserved repo names', () => {
    expect(detectGithubRepo('https://github.com/owner/issues')).toBeUndefined();
    expect(detectGithubRepo('https://github.com/owner/pulls')).toBeUndefined();
    expect(detectGithubRepo('https://github.com/owner/network')).toBeUndefined();
    expect(detectGithubRepo('https://github.com/owner/stargazers')).toBeUndefined();
  });

  it('rejects empty owner or repo', () => {
    expect(detectGithubRepo('https://github.com/')).toBeUndefined();
    expect(detectGithubRepo('https://github.com/owner/')).toBeUndefined();
  });
});

describe('extractDescription (via parseAwesomeMarkdown)', () => {
  it('strips well-formed Markdown links', () => {
    const result = parseAwesomeMarkdown('- [Project A](https://example.com) — A great tool.\n');
    expect(result.records[0]?.description).toBe('A great tool.');
  });

  it('strips malformed open-link fragments (audit finding)', () => {
    // Some upstream awesome-lists produce `[Naser Elziadna](` with no closing paren.
    const result = parseAwesomeMarkdown(
      '- [Project](https://example.com) [Naser Elziadna]( — extra.\n',
    );
    expect(result.records[0]?.description).not.toContain('[Naser Elziadna]');
    // The dangling open-paren from the malformed fragment should be cleaned up.
    expect(result.records[0]?.description).not.toMatch(/[A-Za-z]\(\s+—/);
  });

  it('strips bare-bracket fragments', () => {
    const result = parseAwesomeMarkdown('- [Project](https://example.com) [@handle] extra.\n');
    expect(result.records[0]?.description).not.toContain('[@handle]');
  });
});

describe('parseAwesomeMarkdown', () => {
  it('groups items under heading categories', () => {
    const md = `# Awesome List

## Productivity

- [Tool A](https://example.com/a) — Tool for A.
- [Tool B](https://example.com/b) — Tool for B.

## Design

- [Asset C](https://example.com/c) — Asset for C.
`;
    const result = parseAwesomeMarkdown(md);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]?.category).toBe('Productivity');
    expect(result.records[2]?.category).toBe('Design');
    expect(result.report.categories).toEqual(['Productivity', 'Design']);
  });

  it('skips lines with no external link', () => {
    const md = '- Just text, no link.\n- [Project](https://example.com) — Real entry.\n';
    const result = parseAwesomeMarkdown(md);
    expect(result.records).toHaveLength(1);
    expect(result.report.skipped).toBe(1);
  });

  it('treats heading content after # as the document title, not a category', () => {
    const md = '# Awesome Tools\n\n- [Tool A](https://example.com) — A.\n';
    const result = parseAwesomeMarkdown(md);
    expect(result.records[0]?.category).toBe('uncategorized');
  });

  it('records the source URL when provided', () => {
    const md = '- [Tool A](https://example.com) — A.\n';
    const result = parseAwesomeMarkdown(md, {
      file: 'README.md',
      sourceUrl: 'https://github.com/owner/repo',
    });
    expect(result.records[0]?.links.source).toBe('https://github.com/owner/repo');
  });

  it('skips anchor-only links', () => {
    const md =
      '- [Section link](#usage) — should be skipped.\n- [Tool A](https://example.com) — real.\n';
    const result = parseAwesomeMarkdown(md);
    expect(result.records).toHaveLength(1);
    expect(result.report.anchorLinksSkipped).toBe(1);
  });

  it('captures duplicate slugs when the same label appears twice', () => {
    const md = `
- [Project A](https://example.com/a) — A1.
- [Project A](https://example.com/b) — A2.
`;
    const result = parseAwesomeMarkdown(md);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.slug).not.toBe(result.records[1]?.slug);
    expect(result.report.duplicateSlugs).toBe(1);
  });

  it('skips lines inside a recognised TOC block', () => {
    const md = `
## Contents

- [First section](#first-section)
- [Second section](#second-section)

## Real Category

- [Tool A](https://example.com/a) — A.
`;
    const result = parseAwesomeMarkdown(md);
    expect(result.records).toHaveLength(1);
    expect(result.report.tocSkipped).toBe(2);
  });
});
