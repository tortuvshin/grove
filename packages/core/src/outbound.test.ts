import { describe, expect, it } from 'vitest';
import { resolveOutboundRef, withRef } from './outbound.js';

const on = { ref: 'example.dev' };

describe('withRef', () => {
  it('tags a project site', () => {
    expect(withRef('https://anarlog.so/download', on)).toBe(
      'https://anarlog.so/download?ref=example.dev',
    );
  });

  it('leaves forges, stores and registries alone', () => {
    for (const url of [
      'https://github.com/a/b',
      'https://apps.apple.com/app/id1',
      'https://play.google.com/store/apps/details?id=x',
      'https://www.npmjs.com/package/x',
    ]) {
      expect(withRef(url, on)).toBe(url);
    }
  });

  it('honours extra skip hosts, including subdomains', () => {
    expect(withRef('https://docs.acme.io/', { ...on, skipHosts: ['acme.io'] })).toBe(
      'https://docs.acme.io/',
    );
  });

  it('keeps an existing ref or utm_source', () => {
    expect(withRef('https://x.dev/?utm_source=news', on)).toBe('https://x.dev/?utm_source=news');
    expect(withRef('https://x.dev/?ref=a', on)).toBe('https://x.dev/?ref=a');
  });

  it('does nothing when attribution is off or the URL is not http', () => {
    expect(withRef('https://x.dev/', { ref: false })).toBe('https://x.dev/');
    expect(withRef('mailto:a@b.c', on)).toBe('mailto:a@b.c');
    expect(withRef(undefined, on)).toBeUndefined();
  });
});

describe('resolveOutboundRef', () => {
  it('defaults to the site host and respects false', () => {
    expect(resolveOutboundRef(undefined, 'https://www.example.dev/')).toBe('example.dev');
    expect(resolveOutboundRef('custom', 'https://example.dev')).toBe('custom');
    expect(resolveOutboundRef(false, 'https://example.dev')).toBe(false);
    expect(resolveOutboundRef(undefined, undefined)).toBe(false);
  });
});
