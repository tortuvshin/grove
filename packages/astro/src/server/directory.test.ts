/**
 * Tests for the markdown → safe-HTML pipeline in `directory.ts`.
 *
 * `directory.ts` imports `@grove/generated/*.json` at module load (build-time
 * artifacts), which don't exist in the test environment. We mock those JSON
 * imports so the module can be loaded for its pure functions (specifically
 * `renderMarkdownToSafeHtml`).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@grove/generated/records.full.json', () => ({ default: { records: [] } }));
vi.mock('@grove/generated/records.index.json', () => ({ default: { records: [] } }));
vi.mock('@grove/generated/site-config.json', () => ({ default: {} }));

const { renderMarkdownToSafeHtml } = await import('./directory.js');

describe('renderMarkdownToSafeHtml', () => {
  it('renders basic paragraphs', () => {
    const html = renderMarkdownToSafeHtml('Hello, **world**.');
    expect(html).toContain('<strong>world</strong>');
  });

  it('renders headings with stable ids', () => {
    const html = renderMarkdownToSafeHtml('## My Section');
    expect(html).toMatch(/<h2[^>]*id="my-section"[^>]*>My Section<\/h2>/);
  });

  it('deduplicates repeated heading ids', () => {
    const html = renderMarkdownToSafeHtml('## Examples\n\n## Examples\n');
    const ids = [...html.matchAll(/id="(examples(?:-\d+)?)"/g)].map((m) => m[1]);
    expect(ids).toEqual(['examples', 'examples-2']);
  });

  it('strips script tags from the body', () => {
    const html = renderMarkdownToSafeHtml(
      'Some text.\n\n<script>alert("xss")</script>\n\nMore text.',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(');
  });

  it('strips inline event handler attributes from links', () => {
    const html = renderMarkdownToSafeHtml('[click](https://example.com "onclick=alert(1)")');
    // The sanitizer's allowlist is `["href", "title", "rel", "target"]` for
    // `<a>` tags — `onclick` is never an attribute. (The substring `onclick=`
    // may appear inside a `title="…"` tooltip, but that's plain text.)
    expect(html).not.toMatch(/<a[^>]*\sonclick\s*=/i);
    expect(html).toContain('href="https://example.com"');
  });

  it('forces noopener noreferrer on links', () => {
    const html = renderMarkdownToSafeHtml('[link](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('rejects javascript: URLs', () => {
    const html = renderMarkdownToSafeHtml('[evil](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/<a[^>]*href/);
  });

  it('forces img loading=lazy decoding=async', () => {
    const html = renderMarkdownToSafeHtml('![alt](https://example.com/img.png)');
    expect(html).toMatch(/loading="lazy"/);
    expect(html).toMatch(/decoding="async"/);
  });

  it('strips style attributes from disallowed tags', () => {
    const html = renderMarkdownToSafeHtml(
      '<a href="https://example.com" style="color:red">link</a>',
    );
    expect(html).not.toMatch(/<a[^>]*style/);
  });

  it('renders GFM tables inside the table-wrap div', () => {
    const md = `
| col1 | col2 |
| ---- | ---- |
| a    | b    |
`;
    const html = renderMarkdownToSafeHtml(md);
    expect(html).toContain('grove-prose-table-wrap');
    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });

  it('renders task-list checkboxes as disabled', () => {
    const md = '- [x] done\n- [ ] todo\n';
    const html = renderMarkdownToSafeHtml(md);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
  });

  it('accepts a narrower page allowlist', () => {
    const html = renderMarkdownToSafeHtml('<details><summary>x</summary>y</details>', {
      allowlist: [
        'h1',
        'h2',
        'h3',
        'h4',
        'p',
        'br',
        'hr',
        'ul',
        'ol',
        'li',
        'strong',
        'em',
        'b',
        'i',
        'u',
        's',
        'del',
        'a',
        'code',
        'pre',
        'blockquote',
        'img',
      ],
    });
    expect(html).not.toContain('<details');
  });
});
