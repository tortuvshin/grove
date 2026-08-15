/**
 * WCAG contrast math for the configured brand color.
 *
 * BaseLayout derives every primary-* custom property from one place so
 * the button background and its text can never drift apart (the old
 * pipeline mixed the dark variant in CSS `color-mix` while the
 * foreground stayed a build-time guess — white on `#16a34a` shipped at
 * 3.3:1). All derivation happens at build time in sRGB; the emitted
 * values are plain hex.
 */

const INK_950 = "#0a0a0a";
const WHITE = "#ffffff";
const AA_NORMAL = 4.5;

export type Rgb = [number, number, number];

/** Parse #rgb / #rrggbb (also tolerates #rrggbbaa, alpha ignored). */
export function hexToRgb(hex: string): Rgb | null {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(full)) return null;
  const int = Number.parseInt(full.slice(0, 6), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance (sRGB linearization, not the quick luma). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(color: Rgb, toward: Rgb, amount: number): Rgb {
  return [
    color[0] + (toward[0] - color[0]) * amount,
    color[1] + (toward[1] - color[1]) * amount,
    color[2] + (toward[2] - color[2]) * amount,
  ];
}

/**
 * Shift `hex` toward `toward` in small steps until `text` reaches AA
 * contrast on it. Returns the first passing color (or the endpoint —
 * black/white always pass against each other's text color).
 */
function adjustUntilAA(hex: string, toward: string, text: string): string {
  const start = hexToRgb(hex);
  const end = hexToRgb(toward);
  if (!start || !end) return hex;
  for (let step = 0; step <= 100; step += 2) {
    const candidate = rgbToHex(mix(start, end, step / 100));
    if (contrastRatio(candidate, text) >= AA_NORMAL) return candidate;
  }
  return toward;
}

export interface PrimaryPalette {
  /** Light-theme solid fill (AA-adjusted when the raw hex can't carry text). */
  solid: string;
  /** Text on `solid`. */
  solidForeground: string;
  /** Dark-theme lifted fill. */
  dark: string;
  /** Text on `dark`. */
  darkForeground: string;
}

/**
 * Derive the full primary palette from the configured brand hex.
 *
 * Light: keep the raw hex when white or near-black text reaches AA on
 * it; otherwise darken toward black until white passes (`#16a34a` →
 * a green-700-family solid).
 * Dark: lift toward white (mirroring the old `color-mix` 72/28 split),
 * then keep lifting until near-black text passes AA.
 */
export function derivePrimaryPalette(hex: string): PrimaryPalette | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  let solid = hex;
  let solidForeground = WHITE;
  if (contrastRatio(hex, WHITE) >= AA_NORMAL) {
    solidForeground = WHITE;
  } else if (contrastRatio(hex, INK_950) >= AA_NORMAL) {
    solidForeground = INK_950;
  } else {
    solid = adjustUntilAA(hex, "#000000", WHITE);
    solidForeground = WHITE;
  }

  const lifted = rgbToHex(mix(rgb, hexToRgb(WHITE) as Rgb, 0.28));
  const dark = contrastRatio(lifted, INK_950) >= AA_NORMAL
    ? lifted
    : adjustUntilAA(lifted, WHITE, INK_950);

  return { solid, solidForeground, dark, darkForeground: INK_950 };
}
