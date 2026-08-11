import { describe, expect, it } from 'vitest';
import { ExtendDocsSchema, heroLayoutSchema } from '../schema.js';

describe('heroLayoutSchema', () => {
  it('accepts the documented layouts', () => {
    expect(heroLayoutSchema.parse('centered')).toBe('centered');
    expect(heroLayoutSchema.parse('centered-top')).toBe('centered-top');
    expect(heroLayoutSchema.parse('split-left')).toBe('split-left');
    expect(heroLayoutSchema.parse('split-right')).toBe('split-right');
    expect(heroLayoutSchema.parse('banner')).toBe('banner');
  });

  it("defaults to 'centered' when undefined", () => {
    expect(heroLayoutSchema.parse(undefined)).toBe('centered');
  });

  it('rejects unknown layout ids', () => {
    expect(() => heroLayoutSchema.parse('diagonal')).toThrow();
  });
});

describe('ExtendDocsSchema', () => {
  it('accepts an empty override', () => {
    expect(ExtendDocsSchema.parse({})).toEqual({});
  });

  it('accepts a hero with layout + announcement', () => {
    const out = ExtendDocsSchema.parse({
      hero: {
        layout: 'split-left',
        announcement: { text: 'New', link: '/blog/new' },
      },
    });
    expect(out.hero?.layout).toBe('split-left');
    expect(out.hero?.announcement?.text).toBe('New');
    expect(out.hero?.announcement?.link).toBe('/blog/new');
  });

  it('rejects invalid announcement shape', () => {
    expect(() =>
      ExtendDocsSchema.parse({
        hero: { announcement: { text: 'x' } },
      }),
    ).toThrow();
  });
});
