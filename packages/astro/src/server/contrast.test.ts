import { describe, expect, it } from "vitest";
import { contrastRatio, derivePrimaryPalette, hexToRgb, relativeLuminance, rgbToHex } from "./contrast";

describe("WCAG contrast math", () => {
  it("parses 3- and 6-digit hex and rejects garbage", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#16a34a")).toEqual([0x16, 0xa3, 0x4a]);
    expect(hexToRgb("#16a34aff")).toEqual([0x16, 0xa3, 0x4a]);
    expect(hexToRgb("#xyz")).toBeNull();
    expect(hexToRgb("green")).toBeNull();
  });

  it("computes relative luminance at the anchors", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("computes the canonical 21:1 black/white ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("confirms the audit finding: white on #16a34a fails AA", () => {
    const ratio = contrastRatio("#16a34a", "#ffffff");
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe("derivePrimaryPalette", () => {
  it("pairs #16a34a with AA text instead of white (the P0 fix)", () => {
    // White on #16a34a is 3.3:1 (the shipped failure). Near-black
    // reaches 6:1, so the brand hex stays exact and the TEXT changes.
    const palette = derivePrimaryPalette("#16a34a");
    expect(palette).not.toBeNull();
    const p = palette as NonNullable<typeof palette>;
    expect(p.solid).toBe("#16a34a");
    expect(p.solidForeground).toBe("#0a0a0a");
    expect(contrastRatio(p.solid, p.solidForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("darkens a mid-tone hex only when no text color reaches AA on it", () => {
    // #777777: white is ~4.48:1 and near-black ~4.42:1 — neither
    // passes, so the solid must shift until white does.
    const p = derivePrimaryPalette("#777777");
    expect(p).not.toBeNull();
    const pal = p as NonNullable<typeof p>;
    expect(pal.solid).not.toBe("#777777");
    expect(pal.solidForeground).toBe("#ffffff");
    expect(contrastRatio(pal.solid, pal.solidForeground)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps an already-AA dark brand color untouched with white text", () => {
    const p = derivePrimaryPalette("#15803d");
    expect(p?.solid).toBe("#15803d");
    expect(p?.solidForeground).toBe("#ffffff");
  });

  it("pairs a light brand color with near-black text instead of mutating it", () => {
    const p = derivePrimaryPalette("#facc15");
    expect(p?.solid).toBe("#facc15");
    expect(p?.solidForeground).toBe("#0a0a0a");
  });

  it("always yields an AA dark-theme pair from the lifted variant", () => {
    for (const hex of ["#16a34a", "#1d4ed8", "#0a0a0a", "#facc15", "#e11d48"]) {
      const p = derivePrimaryPalette(hex);
      expect(p, hex).not.toBeNull();
      const pal = p as NonNullable<typeof p>;
      expect(contrastRatio(pal.dark, pal.darkForeground), hex).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(pal.solid, pal.solidForeground), hex).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("returns null for unparseable input", () => {
    expect(derivePrimaryPalette("rebeccapurple")).toBeNull();
  });

  it("round-trips rgb↔hex", () => {
    expect(rgbToHex(hexToRgb("#16a34a") as [number, number, number])).toBe("#16a34a");
  });
});
