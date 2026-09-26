import { describe, expect, it } from 'vitest';
import { projectRecordSchema } from './schema.js';

const base = { slug: 'x', kind: 'project', name: 'X', category: 'tools' } as const;

describe('record submittedBy', () => {
  it('keeps a GitHub login and strips a leading @', () => {
    expect(projectRecordSchema.parse({ ...base, submittedBy: '@octo-cat' }).submittedBy).toBe(
      'octo-cat',
    );
  });

  it('is optional', () => {
    expect(projectRecordSchema.parse(base).submittedBy).toBeUndefined();
  });

  it('rejects something that is not a login', () => {
    expect(() => projectRecordSchema.parse({ ...base, submittedBy: 'not a login' })).toThrow(
      /GitHub login/,
    );
  });
});
