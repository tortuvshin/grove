import { describe, expect, it } from 'vitest';
import { unifiedDiff } from './unified-diff.js';

describe('unifiedDiff', () => {
  it('returns an empty string for identical input, so callers can skip a file', () => {
    expect(unifiedDiff('a\nb\n', 'a\nb\n', 'x.astro')).toBe('');
  });

  it('renders a header, a hunk range, and +/- lines for a single-line change', () => {
    const patch = unifiedDiff('one\ntwo\nthree\n', 'one\nTWO\nthree\n', 'src/x.astro');
    expect(patch).toContain('--- a/src/x.astro');
    expect(patch).toContain('+++ b/src/x.astro');
    expect(patch).toContain('-two');
    expect(patch).toContain('+TWO');
    expect(patch).toContain(' one');
    expect(patch).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/m);
  });

  it('keeps unchanged lines out of the patch when they are far from any change', () => {
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    const after = before.replace('line 20', 'line twenty');
    const patch = unifiedDiff(before, after, 'f.txt');
    expect(patch).toContain('-line 20');
    expect(patch).toContain('+line twenty');
    // Three lines of context either side, nothing beyond.
    expect(patch).toContain(' line 17');
    expect(patch).not.toContain(' line 16');
    expect(patch).toContain(' line 23');
    expect(patch).not.toContain(' line 24');
  });

  it('handles pure additions and pure deletions', () => {
    expect(unifiedDiff('', 'new\n', 'f')).toContain('+new');
    expect(unifiedDiff('gone\n', '', 'f')).toContain('-gone');
  });

  it('emits a separate hunk per distant change', () => {
    const before = Array.from({ length: 60 }, (_, i) => `l${i}`).join('\n');
    const after = before.replace('l5', 'L5').replace('l50', 'L50');
    const hunks = unifiedDiff(before, after, 'f').match(/^@@ /gm) ?? [];
    expect(hunks).toHaveLength(2);
  });
});
