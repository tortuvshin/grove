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
const baseLayoutMarkup = readFileSync(
  resolve(import.meta.dirname, "layouts/BaseLayout.astro"),
  "utf8",
);
const smartLensMarkup = readFileSync(
  resolve(import.meta.dirname, "components/SmartLensTabs.astro"),
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
    // The scaffold must not REDEFINE the package's foundation tokens
    // (`--color-ink-*`, font stacks, color-scheme). It may REFERENCE
    // them via `var(--color-ink-*, fallback)` — that's a consumer
    // pattern, not a duplication. The regexes below match definitions
    // only: a colon followed by a space or value, not a closing
    // parenthesis (which would catch the `fallback` argument).
    expect(scaffoldTheme).not.toMatch(/--color-ink-\d+:\s/);
    expect(scaffoldTheme).not.toMatch(/--color-ink-\d+:/);
    expect(scaffoldTheme).not.toMatch(/font-family:\s*ui-/);
    expect(scaffoldTheme).not.toMatch(/--font-(sans|mono):\s/);
    expect(scaffoldTheme).not.toContain("color-scheme: dark light");
  });

  it("styles components in HTML with Starlight-aligned Tailwind utilities", () => {
    expect(tailwindMarkup).toContain("rounded-[calc(var(--radius)+0.25rem)]");
    expect(tailwindMarkup).toContain("rounded-full");
    expect(tailwindMarkup).toContain("min-h-5");
    expect(tailwindMarkup).toContain("h-8");
    expect(tailwindMarkup).toContain("focus-visible:ring-3");
    // No bespoke component-level classes (the legacy `.grove-card`
    // and `.grove-btn` selectors that survived V0). The package
    // does ship design-system selectors — `.grove-prose` for the
    // rendered markdown, `.grove-sidebar` / `.grove-card` for the
    // record-detail sidebar, `.grove-toc` for the on-page TOC,
    // `[data-activity-tone="..."]` for the activity badge — but
    // these are the package's own design tokens (equivalent to a
    // `.btn` class in a CSS framework), not bespoke one-offs.
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

  it("uses directory-wide analytics config unless a page overrides it", () => {
    expect(baseLayoutMarkup).toContain(
      "gaId ?? site.analytics?.googleAnalyticsId",
    );
    expect(baseLayoutMarkup).toContain("effectiveGaId");
  });

  it("lets consumers name the unfiltered lens with their directory noun", () => {
    expect(smartLensMarkup).toContain("allLabel?: string");
    expect(smartLensMarkup).toContain(
      'lens.id === "all" && allLabel ? allLabel : lensDisplay(lens.id)',
    );
  });
});
