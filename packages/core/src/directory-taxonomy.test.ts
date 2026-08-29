import { describe, expect, it } from 'vitest';

import { countByStack, projectStackIds } from './directory-taxonomy.js';

describe('projectStackIds', () => {
  it('keeps the primary stack first and removes compatibility duplicates', () => {
    expect(
      projectStackIds({
        stack: 'tauri',
        stacks: ['tauri', 'rust', 'typescript', 'rust'],
      }),
    ).toEqual(['tauri', 'rust', 'typescript']);
  });

  it('supports records that only carry the canonical primary stack', () => {
    expect(projectStackIds({ stack: 'flutter', stacks: [] })).toEqual(['flutter']);
  });

  it('does not double-count repeated primary stacks', () => {
    expect(
      countByStack([
        { stack: 'flutter', stacks: ['flutter'] },
        { stack: 'flutter', stacks: [] },
      ]).get('flutter'),
    ).toBe(2);
  });
});
