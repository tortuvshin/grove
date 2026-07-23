import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const astroTheme = readFileSync(resolve(import.meta.dirname, "styles.css"), "utf8");
const scaffoldTheme = readFileSync(
  resolve(import.meta.dirname, "../../../apps/example/src/styles/global.css"),
  "utf8",
);
const tailwindMarkup = [
  "components/ItemCard.astro",
  "layouts/Header.astro",
].map((file) => readFileSync(resolve(import.meta.dirname, file), "utf8")).join("\n") +
  readFileSync(resolve(import.meta.dirname, "../../../apps/example/src/pages/submit.astro"), "utf8");
const iconMarkup = readFileSync(
  resolve(import.meta.dirname, "components/Icon.astro"),
  "utf8",
);
const themeToggleMarkup = readFileSync(
  resolve(import.meta.dirname, "layouts/ThemeToggle.astro"),
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

  it("styles components in HTML with Starlight-aligned Tailwind utilities", () => {
    expect(tailwindMarkup).toContain("rounded-[calc(var(--radius)+0.25rem)]");
    expect(tailwindMarkup).toContain("rounded-full");
    expect(tailwindMarkup).toContain("min-h-5");
    expect(tailwindMarkup).toContain("h-8");
    expect(tailwindMarkup).toContain("focus-visible:ring-3");
    expect(astroTheme).not.toContain(".grove-card");
    expect(astroTheme).not.toContain(".grove-btn");
  });

  it("falls back to initials when a consumer has no matching icon asset", () => {
    expect(iconMarkup).toContain("data-grove-icon-fallback-initials");
    expect(iconMarkup).toContain("onerror=");
    expect(iconMarkup).not.toContain("bundledIcons");
    expect(iconMarkup).toContain("availableIcons === undefined");
    expect(iconMarkup).toContain('"native-ios": "apple"');
    expect(iconMarkup).toContain('kmp: "kotlin"');
  });

  it("gives the theme control and glyph explicit accessible dimensions", () => {
    expect(themeToggleMarkup).toContain("h-9 w-9");
    expect(themeToggleMarkup).toContain('width="18"');
    expect(themeToggleMarkup).toContain('height="18"');
  });
});
