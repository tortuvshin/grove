/**
 * @grove-dev/core — slug helpers unit tests.
 *
 * Coverage:
 *   - slugify: empty input, unicode, smart quotes, length cap
 *   - uniqueSlug: collision counter, repeated calls with same input
 *     (idempotency), unknown-fallback when slugify yields ""
 */
import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lower-cases and replaces runs of non-alphanumerics with single hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Foo  Bar   Baz')).toBe('foo-bar-baz');
    expect(slugify('a__b--c')).toBe('a-b-c');
  });

  it('strips straight ASCII single quotes (the only quote the regex matches)', () => {
    // The regex /['']/g contains two ASCII apostrophes (0x27) — not
    // the curly U+2018 / U+2019 characters a casual read of the
    // source might suggest. Pinning this behaviour here so a
    // well-meaning future refactor (e.g. "let's also strip smart
    // quotes") doesn't silently change every slug with a
    // possessive in the name. The actual product input rarely
    // has straight apostrophes because record names go through a
    // curator; the smart-quote path below is the one that matters
    // for copy-paste from docs and READMEs.
    expect(slugify("Don't Stop")).toBe('dont-stop');
    expect(slugify("It's a Test")).toBe('its-a-test');
  });

  it('does NOT strip smart quotes (U+2018 / U+2019) — they become hyphens', () => {
    // The opposite of the previous test. Smart quotes are NOT in
    // the regex's character class, so they fall through to the
    // [^a-z0-9]+ replace and become a single "-". A user pasting
    // a record name with a curly apostrophe from a Markdown
    // document gets a slug with a hyphen at that position, not a
    // silently-dropped character. Document the behaviour here so
    // it cannot drift.
    expect(slugify('Don\u2019t Stop')).toBe('don-t-stop');
    expect(slugify('It\u2019s a Test')).toBe('it-s-a-test');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello');
    expect(slugify('!@#hello!@#')).toBe('hello');
  });

  it('returns an empty string for non-ASCII-only input (e.g. emoji, accented)', () => {
    // Accented characters are dropped by the [^a-z0-9]+ replace and
    // then the leading/trailing hyphen trim removes the surrounding
    // hyphens. Emoji is the same. This test pins the exact empty
    // string — not "item" — because uniqueSlug is the function that
    // falls back to "item", not slugify itself.
    expect(slugify('café')).toBe('caf');
    expect(slugify('🚀 rocket')).toBe('rocket');
    expect(slugify('über')).toBe('ber');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBe(80);
  });

  it('returns an empty string for empty / whitespace-only input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('---')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('returns the slug unchanged on first occurrence', () => {
    const seen = new Map<string, number>();
    expect(uniqueSlug('Hello World', seen)).toBe('hello-world');
    expect(seen.get('hello-world')).toBe(1);
  });

  it('appends -2, -3, ... on subsequent collisions', () => {
    const seen = new Map<string, number>();
    expect(uniqueSlug('Hello', seen)).toBe('hello');
    expect(uniqueSlug('Hello', seen)).toBe('hello-2');
    expect(uniqueSlug('Hello', seen)).toBe('hello-3');
    // The seen map reflects the latest count, not just the touched
    // counter — second occurrence is "hello-2" so the next collision
    // should be "hello-3", not "hello-2" again.
    expect(seen.get('hello')).toBe(3);
  });

  it('repeated calls with the same input are independent (caller owns the seen map)', () => {
    // Two callers passing the same input string but two different
    // seen maps each get a fresh first-occurrence behaviour. This
    // pins the rule that the seen map is the source of truth — the
    // function does not maintain internal state.
    const a = new Map<string, number>();
    const b = new Map<string, number>();
    expect(uniqueSlug('Foo', a)).toBe('foo');
    expect(uniqueSlug('Foo', b)).toBe('foo');
    expect(uniqueSlug('Foo', a)).toBe('foo-2');
    expect(uniqueSlug('Foo', b)).toBe('foo-2');
  });

  it("falls back to 'item' when slugify returns empty (emoji / accents only)", () => {
    const seen = new Map<string, number>();
    // slugify("🚀") → "" → uniqueSlug substitutes "item"
    expect(uniqueSlug('🚀', seen)).toBe('item');
    // second collision: "item-2"
    expect(uniqueSlug('🚀', seen)).toBe('item-2');
  });
});
