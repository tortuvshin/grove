import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectionIndexable,
  hasEditorialBody,
  recordIndexable,
  taxonomyTermIndexable,
} from './index-policy.js';
import { groveConfigSchema } from './schema.js';

describe('recordIndexable', () => {
  const bare = { hasBody: false, reviewed: false };
  const written = { hasBody: true, reviewed: false };
  const reviewed = { hasBody: true, reviewed: true };

  it("'all' (the default) indexes every visible record", () => {
    expect(recordIndexable(bare)).toBe(true);
    expect(recordIndexable(bare, 'all')).toBe(true);
  });

  it("'editorial' needs a body", () => {
    expect(recordIndexable(bare, 'editorial')).toBe(false);
    expect(recordIndexable(written, 'editorial')).toBe(true);
  });

  it("'editorial-and-reviewed' needs a body and a human review", () => {
    expect(recordIndexable({ hasBody: false, reviewed: true }, 'editorial-and-reviewed')).toBe(
      false,
    );
    expect(recordIndexable(written, 'editorial-and-reviewed')).toBe(false);
    expect(recordIndexable(reviewed, 'editorial-and-reviewed')).toBe(true);
  });

  it('never indexes a hidden or removed record', () => {
    expect(recordIndexable({ ...reviewed, visibility: 'hide' })).toBe(false);
    expect(recordIndexable({ ...reviewed, visibility: 'remove' }, 'editorial')).toBe(false);
  });
});

describe('collectionIndexable', () => {
  it("'all' indexes any non-empty collection not marked seo.index: false", () => {
    expect(collectionIndexable({ entryCount: 3 })).toBe(true);
    expect(collectionIndexable({ entryCount: 0 })).toBe(false);
    expect(collectionIndexable({ entryCount: 3, seoIndex: false })).toBe(false);
  });

  it("'editorial' needs an introduction or a body", () => {
    expect(collectionIndexable({ entryCount: 3 }, 'editorial')).toBe(false);
    expect(collectionIndexable({ entryCount: 3, introduction: '  ' }, 'editorial')).toBe(false);
    expect(collectionIndexable({ entryCount: 3, introduction: 'Why.' }, 'editorial')).toBe(true);
    expect(collectionIndexable({ entryCount: 3, hasBody: true }, 'editorial')).toBe(true);
  });

  it('seo.index: false and an empty list win over an introduction', () => {
    const intro = { introduction: 'Why.' };
    expect(collectionIndexable({ ...intro, entryCount: 3, seoIndex: false }, 'editorial')).toBe(
      false,
    );
    expect(collectionIndexable({ ...intro, entryCount: 0 }, 'editorial')).toBe(false);
  });
});

describe('taxonomyTermIndexable', () => {
  it("'all' indexes any term with records", () => {
    expect(taxonomyTermIndexable({ count: 2 })).toBe(true);
    expect(taxonomyTermIndexable({ count: 0, description: 'Copy.' })).toBe(false);
  });

  it("'editorial' needs the term's description", () => {
    expect(taxonomyTermIndexable({ count: 2 }, 'editorial')).toBe(false);
    expect(taxonomyTermIndexable({ count: 2, description: 'Copy.' }, 'editorial')).toBe(true);
  });
});

describe('hasEditorialBody', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grove-index-policy-'));
  const file = (name: string, text: string) => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  };

  it('is true for a body with content', () => {
    expect(hasEditorialBody(file('a.md', '# A\n\nA written review.\n'))).toBe(true);
  });

  it('is false for a missing pointer, a missing file, or a title-only body', () => {
    expect(hasEditorialBody(undefined)).toBe(false);
    expect(hasEditorialBody(join(dir, 'missing.md'))).toBe(false);
    expect(hasEditorialBody(file('b.md', '---\nslug: b\n---\n# B\n\n'))).toBe(false);
  });
});

describe('seo config', () => {
  it("defaults every policy to 'all'", () => {
    const config = groveConfigSchema.parse({ site: { name: 'Demo' } });
    expect(config.seo).toEqual({
      recordIndexPolicy: 'all',
      collectionIndexPolicy: 'all',
      taxonomyIndexPolicy: 'all',
    });
  });

  it('rejects an unknown policy', () => {
    const result = groveConfigSchema.safeParse({
      site: { name: 'Demo' },
      seo: { recordIndexPolicy: 'reviewed' },
    });
    expect(result.success).toBe(false);
  });
});
