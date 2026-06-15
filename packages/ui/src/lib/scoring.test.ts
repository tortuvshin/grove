/**
 * @grove-dev/ui — scoring primitive unit tests.
 *
 * Coverage:
 *   - scoreTier boundaries 19/20, 39/40, 59/60, 79/80, 99/100
 *   - non-number input → tier 0
 *   - scoreTierLabel produces the right text for each tier
 *   - scoreLabel rounds and falls back to "—" for invalid input
 *   - SCORE_DIMENSIONS order is stable
 */
import { describe, it, expect } from "vitest";
import { scoreTier, scoreTierLabel, scoreLabel, SCORE_DIMENSIONS, SCORE_LABELS } from "./scoring.js";

describe("scoreTier — boundaries", () => {
  it("0–19 maps to tier 0 (very low)", () => {
    expect(scoreTier(0)).toBe(0);
    expect(scoreTier(10)).toBe(0);
    expect(scoreTier(19)).toBe(0);
  });

  it("20 maps to tier 1 (low) — 19/20 boundary inclusive on the higher side", () => {
    // The function uses strict `< 20` to leave tier 0 and `< 40`
    // to leave tier 1, so 20 is the first value in tier 1. The
    // brief calls out the 19/20 boundary as load-bearing — if
    // the threshold ever flips, the score bars across the
    // directory will all visibly shift.
    expect(scoreTier(20)).toBe(1);
  });

  it("39/40 boundary", () => {
    expect(scoreTier(39)).toBe(1);
    expect(scoreTier(40)).toBe(2);
  });

  it("59/60 boundary", () => {
    expect(scoreTier(59)).toBe(2);
    expect(scoreTier(60)).toBe(3);
  });

  it("79/80 boundary", () => {
    expect(scoreTier(79)).toBe(3);
    expect(scoreTier(80)).toBe(4);
  });

  it("99/100 boundary — 100 still tier 4 (no tier 5)", () => {
    expect(scoreTier(99)).toBe(4);
    expect(scoreTier(100)).toBe(4);
  });
});

describe("scoreTier — invalid input", () => {
  it("null / undefined / NaN / Infinity all map to tier 0", () => {
    expect(scoreTier(null)).toBe(0);
    expect(scoreTier(undefined)).toBe(0);
    expect(scoreTier(Number.NaN)).toBe(0);
    expect(scoreTier(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("non-number types collapse to tier 0 (string / boolean / object)", () => {
    expect(scoreTier("50" as unknown as number)).toBe(0);
    expect(scoreTier(true as unknown as number)).toBe(0);
    expect(scoreTier({} as unknown as number)).toBe(0);
  });
});

describe("scoreTierLabel", () => {
  it("emits the right label for each tier", () => {
    expect(scoreTierLabel(5)).toBe("Very low");
    expect(scoreTierLabel(25)).toBe("Low");
    expect(scoreTierLabel(50)).toBe("Medium");
    expect(scoreTierLabel(70)).toBe("High");
    expect(scoreTierLabel(95)).toBe("Very high");
  });

  it("falls back to 'Very low' for invalid input (since it collapses to tier 0)", () => {
    expect(scoreTierLabel(null)).toBe("Very low");
    expect(scoreTierLabel(undefined)).toBe("Very low");
  });
});

describe("scoreLabel", () => {
  it("rounds to the nearest integer and stringifies", () => {
    expect(scoreLabel(50)).toBe("50");
    expect(scoreLabel(50.4)).toBe("50");
    expect(scoreLabel(50.6)).toBe("51");
    expect(scoreLabel(0)).toBe("0");
    expect(scoreLabel(100)).toBe("100");
  });

  it("returns '—' for non-finite or missing input", () => {
    expect(scoreLabel(null)).toBe("—");
    expect(scoreLabel(undefined)).toBe("—");
    expect(scoreLabel(Number.NaN)).toBe("—");
    expect(scoreLabel(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("SCORE_DIMENSIONS / SCORE_LABELS", () => {
  it("SCORE_DIMENSIONS lists the six dimensions in a stable order", () => {
    expect(SCORE_DIMENSIONS).toEqual([
      "activity",
      "maturity",
      "learning",
      "contribution",
      "docs",
      "overall",
    ]);
  });

  it("SCORE_LABELS has a human label for every dimension in SCORE_DIMENSIONS", () => {
    for (const dim of SCORE_DIMENSIONS) {
      expect(SCORE_LABELS[dim]).toBeTypeOf("string");
    }
  });
});
