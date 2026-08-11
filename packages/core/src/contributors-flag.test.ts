import { describe, expect, it } from "vitest";

/**
 * Smoke test for the `showContributionCount` site-config default.
 *
 * The contributors tile in `getContributorsPageModel` exposes a
 * flag so consumers can hide the per-user "N contributions" label.
 * The default must remain `true` (the V1 published behaviour) so
 * existing directories don't change silently — and consumers that
 * opt out get the quieter card.
 */
describe("contributors showContributionCount default", () => {
  it("defaults to true", async () => {
    const { groveConfigSchema } = await import("./schema.js");
    const result = groveConfigSchema.safeParse({
      site: { name: "T" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributors?.showContributionCount).toBe(true);
    }
  });

  it("respects an explicit false opt-out", async () => {
    const { groveConfigSchema } = await import("./schema.js");
    const result = groveConfigSchema.safeParse({
      site: { name: "T" },
      contributors: { showContributionCount: false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contributors?.showContributionCount).toBe(false);
    }
  });
});

