import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroTheme = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/styles/system.css'),
  'utf8',
);
const scaffoldTheme = readFileSync(
  resolve(import.meta.dirname, '../../../apps/example/src/styles/global.css'),
  'utf8',
);
const tailwindMarkup =
  [
    '../../registry/default/components/grove/filter-group-menu.astro',
    '../../registry/default/layouts/header.astro',
  ]
    .map((file) => readFileSync(resolve(import.meta.dirname, file), 'utf8'))
    .join('\n') +
  readFileSync(
    resolve(import.meta.dirname, '../../../apps/example/src/pages/submit.astro'),
    'utf8',
  );
const iconMarkup = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/components/grove/icon.astro'),
  'utf8',
);
// Name resolution lives in lib/ so the icon tests can assert on the
// exact aliases the component applies instead of reimplementing them.
const iconRegistry = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/lib/icon-registry.ts'),
  'utf8',
);
const themeToggleMarkup = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/components/site/theme-toggle.astro'),
  'utf8',
);
const baseLayoutMarkup = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/layouts/base-layout.astro'),
  'utf8',
);
const smartLensMarkup = readFileSync(
  resolve(import.meta.dirname, '../../registry/default/components/grove/smart-lens-tabs.astro'),
  'utf8',
);

describe('Astro theme contract', () => {
  it("keeps Starlight's light and dark foundation values", () => {
    expect(astroTheme).toContain('--grove-background: oklch(100% 0 0)');
    expect(astroTheme).toContain('--grove-foreground: var(--color-ink-950)');
    expect(astroTheme).toContain('--grove-background: var(--color-ink-950)');
    expect(astroTheme).toContain('--grove-foreground: var(--color-ink-50)');
    expect(astroTheme).toContain('--color-ink-50: oklch(98.5% 0 0)');
    expect(astroTheme).toContain('--color-ink-950: oklch(14.5% 0 0)');
  });

  it('exposes runtime semantic colors to Tailwind', () => {
    for (const token of [
      'background',
      'foreground',
      'primary',
      'secondary',
      'muted',
      'accent',
      'border',
      'card',
      'popover',
    ]) {
      expect(astroTheme).toContain(`--color-${token}: var(--grove-${token})`);
    }
  });

  it("keeps raised surfaces in the theme's own family (light cards are light)", () => {
    // The dark landing surface #141516 may exist ONLY as the dark
    // `--grove-surface-raised` value — never in the light block
    // (regression guard for the light-theme dark-card P0).
    expect(astroTheme.match(/#141516/g)?.length).toBe(1);
    expect(astroTheme).toContain('--grove-surface-raised: var(--grove-background)');
    expect(astroTheme).toContain('--grove-surface-raised: #141516');
    expect(astroTheme).toContain('--grove-card: var(--grove-surface-raised)');
    expect(astroTheme).toContain('--grove-popover: var(--grove-surface-overlay)');
  });

  it('defines selection and status roles in both themes', () => {
    for (const token of [
      'surface-raised',
      'surface-sunken',
      'surface-overlay',
      'selected',
      'selected-foreground',
      'success',
      'success-foreground',
      'warning',
      'warning-foreground',
      'danger',
      'danger-foreground',
      'info',
      'info-foreground',
    ]) {
      expect(astroTheme).toContain(`--color-${token}: var(--grove-${token})`);
      // Each runtime token must be defined twice: :root and :root.dark.
      const definitions = astroTheme.match(new RegExp(`--grove-${token}:`, 'g')) ?? [];
      expect(definitions.length, token).toBeGreaterThanOrEqual(2);
    }
  });

  it('derives primary fill and text from one WCAG computation', () => {
    // The old pipeline derived the dark variant in CSS `color-mix`
    // while the foreground stayed a build-time luma guess — the two
    // could drift (white on #16a34a shipped at 3.3:1). Everything now
    // comes from contrast.ts.
    expect(baseLayoutMarkup).not.toContain('color-mix');
    expect(baseLayoutMarkup).toContain('derivePrimaryPalette');
    expect(baseLayoutMarkup).toContain('--grove-theme-primary-dark-foreground');
    expect(astroTheme).toContain(
      '--grove-primary-foreground: var(--grove-theme-primary-dark-foreground, var(--grove-gray-7))',
    );
  });

  it('uses the same system and mono font stacks as the docs', () => {
    expect(astroTheme).toMatch(
      /--font-sans:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,/,
    );
    expect(astroTheme).toMatch(
      /--font-mono:\s*ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,/,
    );
    expect(astroTheme).toContain('font-family: var(--font-sans)');
  });

  it('does not duplicate package-owned foundation tokens in the scaffold', () => {
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
    expect(scaffoldTheme).not.toContain('color-scheme: dark light');
  });

  it('does not start a second Tailwind build from the consumer override file', () => {
    // Tailwind v4's Vite plugin treats every file that imports Tailwind as
    // its own entry point. `system.css` already imports it, so an import
    // here emits a SECOND complete Tailwind build — an extra ~35 KB of CSS
    // that every page downloads on top of the first. The override file
    // needs plain CSS, not the engine.
    // Both files document the rule in prose, so strip comments first and
    // assert on the directives that actually reach the compiler.
    const directives = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(directives(scaffoldTheme)).not.toMatch(/@import\s+["']tailwindcss["']/);
    expect(directives(astroTheme)).toMatch(/@import\s+["']tailwindcss["']/);
  });

  it('styles components in HTML with Starlight-aligned Tailwind utilities', () => {
    expect(tailwindMarkup).toContain('rounded-[calc(var(--radius)+0.25rem)]');
    expect(tailwindMarkup).toContain('rounded-full');
    expect(tailwindMarkup).toContain('min-h-5');
    expect(tailwindMarkup).toContain('h-8');
    expect(tailwindMarkup).toContain('focus-visible:ring-3');
    // No bespoke component-level classes (the legacy `.grove-card`
    // and `.grove-btn` selectors that survived V0). The package
    // does ship design-system selectors — `.grove-prose` for the
    // rendered markdown, `.grove-sidebar` / `.grove-card` for the
    // record-detail sidebar, `.grove-toc` for the on-page TOC,
    // `[data-activity-tone="..."]` for the activity badge — but
    // these are the package's own design tokens (equivalent to a
    // `.btn` class in a CSS framework), not bespoke one-offs.
    expect(astroTheme).not.toContain('.grove-btn');
  });

  it('falls back to initials when a consumer has no matching icon asset', () => {
    expect(iconMarkup).toContain('data-grove-icon-fallback-initials');
    expect(iconMarkup).toContain('onerror=');
    expect(iconMarkup).not.toContain('bundledIcons');
    expect(iconMarkup).toContain('availableIcons === undefined');
    expect(iconRegistry).toMatch(/['"]native-ios['"]: ['"]apple['"]/);
    expect(iconRegistry).toMatch(/kmp: ['"]kotlin['"]/);
  });

  it('classifies icons by kind without gating on a bundled list', () => {
    // `ICON_KINDS` says HOW a packaged icon is painted, never WHETHER
    // it exists. A name it has never heard of must still reach the
    // `<img>` + initials path, or every consumer shipping their own
    // SVG under `public/icons/` breaks silently. The `bundledIcons`
    // guard predates the kind map and still holds: no package-side
    // availability list.
    expect(iconMarkup).toContain('ICON_KINDS[');
    expect(iconMarkup).toMatch(/ICON_KINDS\[asset\.key\] \?\? ['"]color['"]/);
    expect(iconMarkup).toMatch(/effectiveKind === ['"]mono['"]/);
    expect(iconMarkup).not.toContain('bundledIcons');
  });

  it('paints monochrome marks from the foreground token, not a JS src swap', () => {
    // The old model shipped `{name}-light.svg` / `{name}-dark.svg` and
    // swapped `img.src` from an inline script — which shipped inverted
    // for the one icon it was wired to. Masking makes the page own the
    // color, so light/dark falls out with no script.
    //
    // The paint must be `--grove-foreground`, never `currentColor`: a
    // brand mark reads as black-on-light / white-on-dark, and
    // inheriting the surrounding chip's muted `ink-500` turns the
    // Apple logo into a greyed-out smudge.
    expect(astroTheme).toContain('.grove-icon-mask');
    expect(astroTheme).toContain(
      'background-color: var(--grove-icon-mono, var(--grove-foreground))',
    );
    expect(astroTheme).not.toMatch(/\.grove-icon-mask[^}]*background-color:\s*currentColor/);
    expect(astroTheme).toContain('mask-image: var(--grove-icon-url)');
    expect(astroTheme).toContain('-webkit-mask-image: var(--grove-icon-url)');
    // Backgrounds are dropped in print and overridden in forced-colors;
    // without these the mark disappears in both.
    expect(astroTheme).toContain('print-color-adjust: exact');
    expect(astroTheme).toContain('background-color: CanvasText');
    expect(iconMarkup).not.toContain('data-grove-icon-light');
    expect(iconMarkup).not.toContain('MutationObserver');
    expect(iconMarkup).not.toContain('resolvedTheme');
  });

  it('gives the theme control and glyph explicit accessible dimensions', () => {
    expect(themeToggleMarkup).toContain('h-9 w-9');
    expect(themeToggleMarkup).toContain('width="18"');
    expect(themeToggleMarkup).toContain('height="18"');
  });

  it('wires grove.config.ts theme knobs into runtime CSS custom properties', () => {
    // styles.css tokens must fall back through the `--grove-*`
    // overrides that BaseLayout emits on <html>.
    expect(astroTheme).toContain('--radius: var(--grove-radius, 0.625rem)');
    expect(astroTheme).toContain('--container-container: var(--grove-container, 1160px)');
    expect(astroTheme).toContain(
      '--grove-primary: var(--grove-theme-primary, var(--grove-foreground))',
    );
    expect(astroTheme).toContain(
      '--grove-primary: var(--grove-theme-primary-dark, var(--grove-foreground))',
    );
    // BaseLayout resolves the config into the style attribute.
    expect(baseLayoutMarkup).toContain('RADIUS_PRESETS');
    expect(baseLayoutMarkup).toContain('DENSITY_SPACING');
    expect(baseLayoutMarkup).toContain('--grove-theme-primary');
    expect(baseLayoutMarkup).toContain("<html lang={site.locale ?? 'en'} style={themeStyle}>");
  });

  it('uses directory-wide analytics config unless a page overrides it', () => {
    expect(baseLayoutMarkup).toContain('gaId ?? site.analytics?.googleAnalyticsId');
    expect(baseLayoutMarkup).toContain('effectiveGaId');
  });

  it('lets consumers name the unfiltered lens with their directory noun', () => {
    expect(smartLensMarkup).toContain('allLabel?: string');
    expect(smartLensMarkup).toContain(
      'lens.id === "all" && allLabel ? allLabel : lensDisplay(lens.id)',
    );
  });
});
