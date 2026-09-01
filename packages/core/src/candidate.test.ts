import { describe, expect, it } from 'vitest';
import { extractCandidates } from './candidate.js';

describe('extractCandidates', () => {
  it('extracts a basic list item as a candidate', () => {
    const md = '- [Project A](https://example.com/a) — Tool for A.\n';
    const candidates = extractCandidates(md);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe('Project A');
    expect(candidates[0]?.description).toBe('Tool for A.');
    expect(candidates[0]?.links).toEqual([
      { url: 'https://example.com/a', label: 'Project A', kind: 'website' },
    ]);
    expect(candidates[0]?.confidence).toBe(1);
    expect(candidates[0]?.warnings).toEqual([]);
  });

  it('builds sectionPath from nested heading depths', () => {
    const md = `## Productivity

### Web Frameworks

- [Tool A](https://example.com/a) — A.
`;
    const candidates = extractCandidates(md);
    expect(candidates[0]?.sectionPath).toEqual(['Productivity', 'Web Frameworks']);
  });

  it('resets sectionPath when a sibling heading of equal depth appears', () => {
    const md = `## Category One

- [Tool A](https://example.com/a) — A.

## Category Two

- [Tool B](https://example.com/b) — B.
`;
    const candidates = extractCandidates(md);
    expect(candidates[0]?.sectionPath).toEqual(['Category One']);
    expect(candidates[1]?.sectionPath).toEqual(['Category Two']);
  });

  it('captures every link in an item and classifies repository vs website vs unknown', () => {
    const md = '- [Tool A](https://github.com/owner/repo) — desc [site](https://example.com)\n';
    const candidates = extractCandidates(md);
    expect(candidates[0]?.links).toEqual([
      { url: 'https://github.com/owner/repo', label: 'Tool A', kind: 'repository' },
      { url: 'https://example.com', label: 'site', kind: 'website' },
    ]);
  });

  it('emits a candidate for a list item with no links, unlike the regex importer', () => {
    const md = '- Just plain text, no link at all.\n';
    const candidates = extractCandidates(md);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBeUndefined();
    expect(candidates[0]?.links).toEqual([]);
    expect(candidates[0]?.confidence).toBe(0);
    expect(candidates[0]?.warnings).toEqual(['no-links']);
  });

  it('records source line and raw text', () => {
    const md = '# Title\n\n## Category\n\n- [Tool A](https://example.com/a) — A.\n';
    const candidates = extractCandidates(md);
    expect(candidates[0]?.source.line).toBe(5);
    expect(candidates[0]?.source.raw).toContain('[Tool A](https://example.com/a)');
  });

  it('passes options.file and options.sourceUrl through to source', () => {
    const md = '- [Tool A](https://example.com/a) — A.\n';
    const candidates = extractCandidates(md, {
      file: 'README.md',
      sourceUrl: 'https://github.com/owner/repo',
    });
    expect(candidates[0]?.source.file).toBe('README.md');
    expect(candidates[0]?.source.sourceUrl).toBe('https://github.com/owner/repo');
  });
});
