import { describe, expect, it } from 'vitest';
import { compact, formatCount, pluralize, truncateWords } from './directory-format.js';

describe('compact numbers', () => {
  it('keeps small numbers and abbreviates thousands', () => {
    expect(compact(79)).toBe('79');
    expect(compact(1234)).toBe('1.2k');
    expect(compact(12_345)).toBe('12k');
    expect(compact(999_000)).toBe('999k');
  });

  it('switches to millions instead of growing the k count', () => {
    expect(compact(3_374_800)).toBe('3.4M');
    expect(compact(999_950)).toBe('1.0M');
    expect(compact(12_400_000)).toBe('12M');
  });
});

describe('count formatting', () => {
  it('picks the singular form for exactly one', () => {
    expect(pluralize(1, 'project', 'projects')).toBe('project');
    expect(formatCount(1, { singular: 'project', plural: 'projects' })).toBe('1 project');
  });

  it('picks the plural form for zero and many', () => {
    expect(pluralize(0, 'project', 'projects')).toBe('projects');
    expect(pluralize(3, 'project', 'projects')).toBe('projects');
    expect(formatCount(0, { singular: 'project', plural: 'projects' })).toBe('0 projects');
  });

  it('supports irregular plurals via the explicit pair', () => {
    expect(formatCount(2, { singular: 'entity', plural: 'entities' })).toBe('2 entities');
    expect(formatCount(1, { singular: 'entity', plural: 'entities' })).toBe('1 entity');
  });
});

describe('description trimming', () => {
  const long =
    'A Python framework for coordinating role-based autonomous agents, tasks, and multi-step crews.';

  it('leaves anything within budget untouched', () => {
    expect(truncateWords('Short and done.', 140)).toBe('Short and done.');
  });

  it('cuts on a word boundary, never mid-word', () => {
    // The card also line-clamps, but a CSS clamp cuts at whatever
    // character the box runs out of room on — "…and multi-", "…an".
    const trimmed = truncateWords(long, 60);
    expect(trimmed.endsWith('…')).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(61);
    expect(long).toContain(trimmed.slice(0, -1));
    expect(trimmed.slice(0, -1).endsWith(' ')).toBe(false);
    // The last kept word is whole.
    const lastWord = trimmed.slice(0, -1).split(' ').pop() as string;
    expect(long.split(/[\s,.]+/)).toContain(lastWord);
  });

  it('drops trailing punctuation before the ellipsis', () => {
    expect(truncateWords('one two three, four five', 15)).toBe('one two three…');
  });

  it('hard-cuts a single word longer than the budget', () => {
    expect(truncateWords('supercalifragilistic', 10)).toBe('supercalif…');
  });
});
