/**
 * @grove-dev/core — YAML string helpers unit tests.
 *
 * Covers the pure functions that the submit form (and any future
 * record-emitter) uses to produce record YAML safely. Behavior
 * must match the pre-v1 inline implementation byte-for-byte so
 * existing form submissions do not change after the v1 migration.
 */
import { describe, expect, it } from 'vitest';
import { parseGithubRepo, recordSlugify, yamlLines, yamlQuote } from './yaml.js';

describe('recordSlugify', () => {
  it('lowercases and hyphen-separates', () => {
    expect(recordSlugify('Hello World')).toBe('hello-world');
    expect(recordSlugify('Foo  Bar')).toBe('foo-bar');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(recordSlugify(null)).toBe('');
    expect(recordSlugify(undefined)).toBe('');
    expect(recordSlugify('')).toBe('');
    expect(recordSlugify(0)).toBe('');
  });

  it('strips leading and trailing hyphens', () => {
    expect(recordSlugify('---hello---')).toBe('hello');
    expect(recordSlugify('__init__')).toBe('init');
  });

  it('coerces non-strings to strings', () => {
    expect(recordSlugify(42)).toBe('42');
  });
});

describe('parseGithubRepo', () => {
  it('parses canonical https URLs', () => {
    expect(parseGithubRepo('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('strips the .git suffix', () => {
    expect(parseGithubRepo('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('ignores query strings and fragments', () => {
    expect(parseGithubRepo('https://github.com/owner/repo?tab=readme')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('returns null for non-github URLs', () => {
    expect(parseGithubRepo('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGithubRepo('not a url')).toBeNull();
    expect(parseGithubRepo(null)).toBeNull();
  });
});

describe('yamlQuote', () => {
  it('wraps simple values in double quotes', () => {
    expect(yamlQuote('hello')).toBe('"hello"');
  });

  it('escapes backslashes', () => {
    expect(yamlQuote('a\\b')).toBe('"a\\\\b"');
  });

  it('escapes embedded double quotes', () => {
    expect(yamlQuote('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('coerces null/undefined to empty quoted string', () => {
    expect(yamlQuote(null)).toBe('""');
    expect(yamlQuote(undefined)).toBe('""');
  });
});

describe('yamlLines', () => {
  it('renders a YAML block sequence', () => {
    expect(yamlLines(['a', 'b', 'c'])).toBe('  - a\n  - b\n  - c');
  });

  it('respects custom indent', () => {
    expect(yamlLines(['a', 'b'], 4)).toBe('    - a\n    - b');
  });

  it('returns empty string for empty input', () => {
    expect(yamlLines([])).toBe('');
  });
});
