import { describe, expect, it } from 'vitest';
import * as directory from './directory-client.js';
import { recordsFileSchema, resourceSchema } from './index.js';

describe('public schema API', () => {
  it('exports the complete resource validators for consumer migrations', () => {
    expect(recordsFileSchema).toBe(resourceSchema);
    expect(
      recordsFileSchema.safeParse({
        kind: 'project',
        slug: 'example',
        name: 'Example',
      }).success,
    ).toBe(true);
  });

  it('exposes a browser-safe directory discovery entry point', () => {
    expect(directory.filterRecords).toBeTypeOf('function');
    expect(directory.hrefForLens).toBeTypeOf('function');
    expect(directory.sortDisplay).toBeTypeOf('function');
  });
});
