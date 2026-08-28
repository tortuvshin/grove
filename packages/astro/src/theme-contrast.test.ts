/**
 * Token-pair contrast gates — a computational stand-in for visual
 * regression: every foreground/background pair the token system emits
 * must clear WCAG AA (4.5:1 for text), in BOTH themes.
 *
 * The neutral scale is authored in OKLCH; a small oklch→sRGB
 * conversion (neutral colors only need the lightness channel) turns
 * the authored values into hex for the shared contrast math.
 */
import { describe, expect, it } from "vitest";
import { contrastRatio, rgbToHex } from "./server/contrast.js";

/** Neutral (chroma 0) OKLCH lightness → sRGB hex. */
function neutralOklchToHex(lightnessPercent: number): string {
  const L = lightnessPercent / 100;
  // For neutral colors OKLab a=b=0, so l'=m'=s'=L and the linear value
  // is simply L³; then linear → sRGB gamma.
  const linear = L ** 3;
  const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const channel = Math.round(Math.max(0, Math.min(1, srgb)) * 255);
  return rgbToHex([channel, channel, channel]);
}

// The authored ink scale (styles.css @theme).
const ink = {
  50: neutralOklchToHex(98.5),
  100: neutralOklchToHex(97),
  400: neutralOklchToHex(70.8),
  500: neutralOklchToHex(55.6),
  900: neutralOklchToHex(20.5),
  950: neutralOklchToHex(14.5),
};

const AA = 4.5;

describe("light-theme token pairs meet AA", () => {
  const background = "#ffffff";
  const surfaceRaised = "#ffffff";

  it.each([
    ["foreground on background", ink[950], background],
    ["muted-foreground on background", ink[500], background],
    ["muted-foreground on surface-raised", ink[500], surfaceRaised],
    ["selected-foreground on selected", ink[50], ink[900]],
    ["success pair", "#ffffff", "#15803d"],
    ["warning pair", "#ffffff", "#92400e"],
    ["danger pair", "#ffffff", "#b91c1c"],
    ["info pair", "#ffffff", "#1d4ed8"],
  ])("%s", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe("dark-theme token pairs meet AA", () => {
  const background = ink[950];
  const surfaceRaised = "#141516";

  it.each([
    ["foreground on background", ink[50], background],
    ["foreground on surface-raised", ink[50], surfaceRaised],
    ["muted-foreground on background", ink[400], background],
    ["muted-foreground on surface-raised", ink[400], surfaceRaised],
    ["selected-foreground on selected", ink[950], ink[100]],
    ["success pair", "#0a0a0a", "#4ade80"],
    ["warning pair", "#0a0a0a", "#fbbf24"],
    ["danger pair", "#0a0a0a", "#f87171"],
    ["info pair", "#0a0a0a", "#60a5fa"],
  ])("%s", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe("token values in styles.css match the pairs tested here", () => {
  it("pins the status hexes so the test can't silently drift", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(import.meta.dirname, "../../registry/default/styles/system.css"), "utf8");
    for (const hex of ["#15803d", "#92400e", "#b91c1c", "#1d4ed8", "#4ade80", "#fbbf24", "#f87171", "#60a5fa", "#141516"]) {
      expect(css, hex).toContain(hex);
    }
  });
});
