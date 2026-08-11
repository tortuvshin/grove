import { describe, expect, it } from 'vitest';
import { parseQuery } from './collection-cli.js';

describe('parseQuery', () => {
  it('returns an empty object when the path has no query string', () => {
    expect(parseQuery('/browse')).toEqual({});
  });

  it('parses a single key=value pair', () => {
    expect(parseQuery('/browse?stack=Flutter')).toEqual({ stack: 'Flutter' });
  });

  it('parses multiple key=value pairs', () => {
    expect(parseQuery('/browse?stack=Flutter&category=Finance')).toEqual({
      stack: 'Flutter',
      category: 'Finance',
    });
  });

  it('decodes percent-encoded values', () => {
    expect(parseQuery('/browse?category=finance%20%26%20banking')).toEqual({
      category: 'finance & banking',
    });
  });

  it('treats `+` as a literal `+` (not a space), per URLSearchParams semantics', () => {
    expect(parseQuery('/browse?stack=C%2B%2B')).toEqual({ stack: 'C++' });
    expect(parseQuery('/browse?stack=foo+bar')).toEqual({ stack: 'foo bar' });
  });

  it('preserves values containing `=` characters', () => {
    expect(parseQuery('/browse?q=a=b=c')).toEqual({ q: 'a=b=c' });
  });

  it('last-write-wins for repeated keys', () => {
    expect(parseQuery('/browse?stack=A&stack=B')).toEqual({ stack: 'B' });
  });

  it('keeps keys without `=` as empty-string values (URLSearchParams semantics)', () => {
    // URLSearchParams treats `?flag` and `?flag=` as the key with an empty
    // string value — not as a missing key. Document the behavior.
    expect(parseQuery('/browse?flag')).toEqual({ flag: '' });
  });
});
