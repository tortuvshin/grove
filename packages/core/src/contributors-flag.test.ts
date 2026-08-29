import { describe, expect, it } from 'vitest';

/**
 * Smoke test for the `showContributionCount` site-config default.
 *
 * The contributors tile in `getContributorsPageModel` exposes a
 * flag so consumers can hide the per-user "N contributions" label.
 * The default must remain `true` (the V1 published behaviour) so
 * existing directories don't change silently — and consumers that
 * opt out get the quieter card.
 */
describe('contributors showContributionCount default', () => {
  it('defaults to true', async () => {
    const { groveConfigSchema } = await import('./schema.js');
    const result = groveConfigSchema.safeParse({
      site: { name: 'T' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributors?.showContributionCount).toBe(true);
    }
  });

  it('respects an explicit false opt-out', async () => {
    const { groveConfigSchema } = await import('./schema.js');
    const result = groveConfigSchema.safeParse({
      site: { name: 'T' },
      contributors: { showContributionCount: false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributors?.showContributionCount).toBe(false);
    }
  });
});

describe('normalizeGithubIntegration', () => {
  it('expands a blanket boolean into per-feature flags', async () => {
    const { normalizeGithubIntegration } = await import('./schema.js');
    expect(normalizeGithubIntegration(true)).toEqual({
      metadata: true,
      contributors: true,
      health: true,
    });
    expect(normalizeGithubIntegration(false)).toEqual({
      metadata: false,
      contributors: false,
      health: false,
    });
  });

  it('fills missing per-feature flags with false', async () => {
    const { normalizeGithubIntegration } = await import('./schema.js');
    expect(
      normalizeGithubIntegration({ metadata: true, contributors: false, health: false }),
    ).toEqual({ metadata: true, contributors: false, health: false });
    expect(normalizeGithubIntegration(undefined)).toEqual({
      metadata: false,
      contributors: false,
      health: false,
    });
  });
});
