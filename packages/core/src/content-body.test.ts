/**
 * Content body helpers unit tests.
 *
 * Coverage:
 *   - resolveContentPath: candidate ordering, missing file → null,
 *     legacy apps/example fallback
 *   - stripFrontmatter: present / absent, windows line endings,
 *     `---\n` later in the document is NOT mistaken for the close
 *   - readContentFile: frontmatter + body split, missing file → null
 *   - extractToc: depth filter, frontmatter skip, collision counter,
 *     smart-quote / punctuation cleanup, empty body
 *   - readingMetrics: empty body, whitespace, long body, wpm option,
 *     minutes always ≥ 1
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractToc,
  readContentFile,
  readingMetrics,
  resolveContentPath,
  stripFrontmatter,
} from './content-body.js';

let cwd = process.cwd();
let tmpRoot = '';

beforeEach(() => {
  cwd = process.cwd();
  tmpRoot = mkdtempSync(join(tmpdir(), 'grove-content-body-'));
  process.chdir(tmpRoot);
});

afterEach(() => {
  process.chdir(cwd);
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

// ── resolveContentPath ──────────────────────────────────────────────

describe('resolveContentPath', () => {
  it('returns null when no candidate exists', () => {
    expect(resolveContentPath('content/missing.md')).toBeNull();
  });

  it('finds the first existing candidate', () => {
    writeFileSync('relative.md', '# hi', 'utf8');
    const found = resolveContentPath('relative.md');
    expect(found).not.toBeNull();
    expect(found).toMatch(/relative\.md$/);
  });

  it('respects an explicit candidate list', () => {
    mkdirSync('sub', { recursive: true });
    writeFileSync('sub/file.md', '# hi', 'utf8');
    const found = resolveContentPath('file.md', [
      join(tmpRoot, 'sub', 'file.md'),
      join(tmpRoot, 'no', 'such.md'),
    ]);
    expect(found).toBe(join(tmpRoot, 'sub', 'file.md'));
  });

  it('falls back to legacy apps/example layout', () => {
    mkdirSync('apps/example/content', { recursive: true });
    writeFileSync('apps/example/content/legacy.md', '# hi', 'utf8');
    const found = resolveContentPath('content/legacy.md');
    expect(found).toMatch(/apps\/example\/content\/legacy\.md$/);
  });
});

// ── stripFrontmatter ────────────────────────────────────────────────

describe('stripFrontmatter', () => {
  it('strips a leading YAML frontmatter block', () => {
    const text = '---\ntitle: hi\n---\n# body';
    expect(stripFrontmatter(text)).toBe('# body');
  });

  it('returns the text unchanged when no frontmatter is present', () => {
    expect(stripFrontmatter('# body')).toBe('# body');
    expect(stripFrontmatter('')).toBe('');
  });

  it('does NOT strip a `---` that appears later in the document', () => {
    // A horizontal rule inside the body is not a closing fence.
    const text = '---\ntitle: hi\n---\n\npara\n\n---\n\nmore';
    expect(stripFrontmatter(text)).toBe('\npara\n\n---\n\nmore');
  });

  it('returns text unchanged when an opening `---` has no close', () => {
    // The scanner is conservative: an unclosed fence is treated as
    // part of the body so we never silently drop content.
    expect(stripFrontmatter('---\ntitle: hi\n# no close')).toBe('---\ntitle: hi\n# no close');
  });

  it('handles windows line endings', () => {
    const text = '---\r\ntitle: hi\r\n---\r\n# body';
    expect(stripFrontmatter(text)).toBe('# body');
  });
});

// ── readContentFile ─────────────────────────────────────────────────

describe('readContentFile', () => {
  it('returns null when the file does not exist', () => {
    expect(readContentFile('content/missing.md')).toBeNull();
  });

  it('returns body + frontmatter split correctly', () => {
    writeFileSync('joined.md', '---\ntitle: hi\nauthor: grove\n---\n# Body\n\ntext', 'utf8');
    const result = readContentFile('joined.md');
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toBe('title: hi\nauthor: grove');
    expect(result!.body).toBe('# Body\n\ntext');
    expect(result!.path).toMatch(/joined\.md$/);
  });

  it('returns empty frontmatter when there is none', () => {
    writeFileSync('plain.md', '# Body', 'utf8');
    const result = readContentFile('plain.md');
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toBe('');
    expect(result!.body).toBe('# Body');
  });
});

// ── extractToc ──────────────────────────────────────────────────────

describe('extractToc', () => {
  it('returns an empty array for empty input', () => {
    expect(extractToc('')).toEqual([]);
  });

  it('returns an empty array when there are no headings', () => {
    expect(extractToc('just a paragraph\n\nwith two lines')).toEqual([]);
  });

  it('extracts h2 headings by default (h3+ excluded)', () => {
    const body = [
      '## First section',
      'para',
      '## Second section',
      '### nested h3 should be skipped',
      '## Third section',
    ].join('\n');
    expect(extractToc(body)).toEqual([
      { text: 'First section', id: 'first-section', depth: 2 },
      { text: 'Second section', id: 'second-section', depth: 2 },
      { text: 'Third section', id: 'third-section', depth: 2 },
    ]);
  });

  it('includes h3 when maxDepth: 3', () => {
    const body = ['## A', '### A.1', '#### A.1.1', '### A.2'].join('\n');
    expect(extractToc(body, { maxDepth: 3 })).toEqual([
      { text: 'A', id: 'a', depth: 2 },
      // `.` is dropped (matches GitHub's slugger): A.1 → a1, A.2 → a2.
      // The uniqueSlug counter still appends -2 / -3 on collision,
      // but in this test the two IDs are distinct because the
      // post-slug strings differ.
      { text: 'A.1', id: 'a1', depth: 3 },
      { text: 'A.2', id: 'a2', depth: 3 },
    ]);
  });

  it('resolves duplicate headings with -2, -3, …', () => {
    const body = ['## Examples', '## Examples', '## Examples'].join('\n');
    expect(extractToc(body)).toEqual([
      { text: 'Examples', id: 'examples', depth: 2 },
      { text: 'Examples', id: 'examples-2', depth: 2 },
      { text: 'Examples', id: 'examples-3', depth: 2 },
    ]);
  });

  it("falls back to 'section' when the heading is empty after slug rules", () => {
    // Emoji-only heading — headingSlug returns "" → uniqueSlug returns "section".
    const body = '## 🚀';
    expect(extractToc(body)).toEqual([{ text: '🚀', id: 'section', depth: 2 }]);
  });

  it('skips a leading frontmatter block', () => {
    const body = '---\ntitle: hi\n---\n## Actual section';
    expect(extractToc(body)).toEqual([{ text: 'Actual section', id: 'actual-section', depth: 2 }]);
  });

  it('strips inline markdown syntax from the displayed text', () => {
    expect(extractToc('## **Bold** and `code` here')).toEqual([
      { text: 'Bold and code here', id: 'bold-and-code-here', depth: 2 },
    ]);
  });

  it('lowercases and kebab-cases the heading text', () => {
    expect(extractToc('## Hello, World!')).toEqual([
      { text: 'Hello, World!', id: 'hello-world', depth: 2 },
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    // The renderer never emits headings for fenced lines, so a TOC
    // entry here would be a dead anchor link.
    const body = [
      '## Real section',
      '```bash',
      '## not a heading',
      '```',
      '~~~',
      '## also not a heading',
      '~~~',
      '## Another real section',
    ].join('\n');
    expect(extractToc(body)).toEqual([
      { text: 'Real section', id: 'real-section', depth: 2 },
      { text: 'Another real section', id: 'another-real-section', depth: 2 },
    ]);
  });

  it('does not treat a nested different fence marker as a closer', () => {
    const body = ['```md', '~~~', '## hidden', '```', '## Visible'].join('\n');
    expect(extractToc(body)).toEqual([{ text: 'Visible', id: 'visible', depth: 2 }]);
  });
});

// ── readingMetrics ──────────────────────────────────────────────────

describe('readingMetrics', () => {
  it('returns zeros (and minutes=1 floor) for empty input', () => {
    expect(readingMetrics('')).toEqual({ wordCount: 0, minutes: 1 });
    expect(readingMetrics('   \n\n   ')).toEqual({ wordCount: 0, minutes: 1 });
  });

  it('counts whitespace-separated tokens', () => {
    const body = 'one two three four five';
    expect(readingMetrics(body)).toEqual({ wordCount: 5, minutes: 1 });
  });

  it('rounds minutes up', () => {
    // 401 words at 200 wpm → ceil(2.005) → 3
    const body = 'w '.repeat(401).trim();
    expect(readingMetrics(body)).toEqual({ wordCount: 401, minutes: 3 });
  });

  it('honours the wpm option', () => {
    const body = 'w '.repeat(120).trim();
    // 120 words / 100 wpm = 1.2 → 2
    expect(readingMetrics(body, { wpm: 100 })).toEqual({
      wordCount: 120,
      minutes: 2,
    });
  });

  it('never returns minutes: 0 for short bodies', () => {
    expect(readingMetrics('hi')).toEqual({ wordCount: 1, minutes: 1 });
  });
});
