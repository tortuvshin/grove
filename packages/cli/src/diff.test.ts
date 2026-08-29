/**
 * @grove-dev/cli — diff classifier unit tests.
 *
 * The three-way classifier is the load-bearing piece of
 * `grove update`. These tests pin the rule from §5 of the v1
 * architecture spec — locally_modified is **never** overwritten,
 * even with `--force`.
 */
import { describe, expect, it } from 'vitest';
import { classify, planUpdate } from './diff.js';

const h = (suffix: string) => `sha256-${suffix.padEnd(64, '0')}` as const;

describe('classify', () => {
  it('returns unchanged when all three hashes match', () => {
    expect(classify({ installed: h('a'), lock: h('a'), registry: h('a') })).toBe('unchanged');
  });

  it('returns upstream_changed when only registry differs', () => {
    expect(classify({ installed: h('a'), lock: h('a'), registry: h('b') })).toBe(
      'upstream_changed',
    );
  });

  it('returns locally_modified when only installed differs from lock', () => {
    expect(classify({ installed: h('c'), lock: h('a'), registry: h('a') })).toBe(
      'locally_modified',
    );
  });

  it('returns conflict when both sides moved', () => {
    expect(classify({ installed: h('c'), lock: h('a'), registry: h('b') })).toBe('conflict');
  });

  it('returns new when only registry has the file', () => {
    expect(classify({ installed: null, lock: null, registry: h('a') })).toBe('new');
  });

  it('returns removed when only consumer has the file', () => {
    expect(classify({ installed: h('a'), lock: h('a'), registry: null })).toBe('removed');
  });
});

describe('planUpdate', () => {
  it('sorts every bucket by key for stable output', () => {
    const plan = planUpdate(
      new Map([
        ['a.astro', h('c')], // locally edited
        ['b.astro', h('a')], // unchanged
      ]),
      new Map([
        ['a.astro', h('a')],
        ['b.astro', h('a')],
      ]),
      new Map([
        ['a.astro', h('a')], // registry still on upstream version
        ['b.astro', h('a')],
        ['c.astro', h('d')], // new in registry
      ]),
    );
    expect(plan.locally_modified).toEqual(['a.astro']);
    expect(plan.unchanged).toEqual(['b.astro']);
    expect(plan.new).toEqual(['c.astro']);
  });

  it('never classifies a locally_modified file as upstream_changed', () => {
    const plan = planUpdate(
      new Map([['x.astro', h('c')]]),
      new Map([['x.astro', h('a')]]),
      new Map([['x.astro', h('a')]]),
    );
    expect(plan.locally_modified).toContain('x.astro');
    expect(plan.upstream_changed).not.toContain('x.astro');
    expect(plan.conflict).not.toContain('x.astro');
  });
});
