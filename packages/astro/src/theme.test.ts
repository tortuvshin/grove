import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const astroTheme = readFileSync(resolve(import.meta.dirname, "styles.css"), "utf8");
const scaffoldTheme = readFileSync(
  resolve(import.meta.dirname, "../templates/default/src/styles/global.css"),
  "utf8",
);

describe("Astro theme contract", () => {
  it("keeps Starlight's light and dark foundation values", () => {
    expect(astroTheme).toContain("--grove-background: oklch(100% 0 0)");
    expect(astroTheme).toContain("--grove-foreground: var(--color-ink-950)");
    expect(astroTheme).toContain("--grove-background: var(--color-ink-950)");
    expect(astroTheme).toContain("--grove-foreground: var(--color-ink-50)");
    expect(astroTheme).toContain("--color-ink-50: oklch(98.5% 0 0)");
    expect(astroTheme).toContain("--color-ink-950: oklch(14.5% 0 0)");
  });

  it("exposes runtime semantic colors to Tailwind", () => {
    for (const token of [
      "background",
      "foreground",
      "primary",
      "secondary",
      "muted",
      "accent",
      "border",
      "card",
      "popover",
    ]) {
      expect(astroTheme).toContain(`--color-${token}: var(--grove-${token})`);
    }
  });

  it("uses the same system and mono font stacks as the docs", () => {
    expect(astroTheme).toContain(
      '--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,',
    );
    expect(astroTheme).toContain(
      "--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,",
    );
    expect(astroTheme).toContain("font-family: var(--font-sans)");
  });

  it("does not duplicate package-owned foundation tokens in the scaffold", () => {
    expect(scaffoldTheme).not.toContain("--color-ink-");
    expect(scaffoldTheme).not.toContain("font-family:");
    expect(scaffoldTheme).not.toContain("color-scheme:");
  });

  it("keeps chips and buttons aligned with Starlight primitives", () => {
    expect(astroTheme).toContain("border-radius: 9999px");
    expect(astroTheme).toContain("min-height: 1.25rem");
    expect(astroTheme).toContain("font-size: 0.75rem");
    expect(astroTheme).toContain("height: 2rem");
    expect(astroTheme).toContain("box-shadow: 0 0 0 3px color-mix");
  });
});
