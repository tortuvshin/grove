# Terminal Display Refactor Design

## Summary

Refactor the three inline terminal/code displays on the Grove docs home page
into purpose-built, reusable Astro components in `docs/src/components/`,
add interactivity (tab switching, copy-to-clipboard, animated caret) via
vanilla `<script>` islands, and adopt a macOS-style terminal frame for the
multi-line code card. Inspired by the "How It Works" workflow preview in
ignite.dev.mn's `workflow.tsx`, but adapted for a documentation site that
already has the rest of its visual language established.

No new section is added. No new dependency is added. No new framework is
adopted.

## Goals

- Replace the three inline terminal/code patterns in `HomeLanding.astro`
  (`hero-command`, `code-card`, final-CTA inline `<code>`) with reusable
  Astro components.
- Make the multi-line code card visually richer (macOS-style frame with
  traffic-light dots, title-bar tab pills, animated caret) so it earns its
  place as the visual centerpiece of the "Get Started In Seconds" section.
- Add interactive behavior that the inline patterns lack: working
  package-manager tab switching, copy-to-clipboard on every command display,
  an animated caret on the last command line.
- Match the project's existing conventions: scoped `<style>`, sibling
  `*.test.ts`, JSDoc header, `interface Props`, `--sl-*` token consumption,
  `aria-*` everywhere.
- Keep the change small, atomic, and easy to review.

## Non-goals

- Adding a new "How It Works" section to the home page.
- Publishing the new components as part of `@grove-dev/astro` (they stay
  docs-site-local).
- Adding Tailwind, React, Vue, Svelte, Shiki, or any other dependency.
- Per-token syntax highlighting (only the `$` prompt gets a subtle cyan).
- Refactoring anything else in `HomeLanding.astro` (Hero text, What Is Grove,
  Ecosystem, Powered By, Final CTA prose, the `.starter-preview` card).

## Components

Three new files in `docs/src/components/`:

| File | Used in section | What it renders | Interactive features |
|---|---|---|---|
| `HeroCommand.astro` | Hero | Single inline line: `$ <command> ⧉` | Copy button |
| `CodeCard.astro` | Get Started In Seconds | Multi-line CLI block with macOS-style frame, traffic-light dots, title-bar tab pills, animated caret | Tab switching (pnpm/npm/bun) · Copy button · Animated caret |
| `CtaCode.astro` | Final CTA | Pill-shaped inline code with copy-on-hover button | Copy button |

All three share two pieces of internal logic (not separate files):

- **Copy button** — same 6-line `navigator.clipboard.writeText` snippet in
  each component, scoped via `document.currentScript.previousElementSibling`.
- **Animated caret** (CodeCard only) — pure CSS `@keyframes`, no JS.

No shared JavaScript file, no shared component file. Each component is
self-contained and trivially understandable in isolation.

## Props

### `HeroCommand.astro`

```ts
interface Props {
  command: string;
  copyLabel?: string; // a11y label, default: "Copy command"
}
```

### `CodeCard.astro`

```ts
interface Props {
  tabs: { label: string; commands: string[] }[];
  defaultTab?: string; // default: tabs[0].label
  copyLabel?: string; // default: "Copy commands"
}
```

### `CtaCode.astro`

```ts
interface Props {
  command: string;
  copyLabel?: string; // default: "Copy command"
}
```

## Visual design

### `CodeCard.astro` (macOS-style frame, chosen by user from 3 mockups)

```
┌────────────────────────────────────────────┐
│ ● ● ●   [pnpm] [npm] [bun]         ⧉ copy  │
├────────────────────────────────────────────┤
│ $ npx @grove-dev/cli@latest new my-space   │
│ $ cd my-space                              │
│ $ pnpm install                             │
│ $ pnpm dev█                                │
└────────────────────────────────────────────┘
```

- **Outer frame**: rounded 10 px, 1 px border derived from `--home-border`,
  22 px shadow (matches current `.code-card` shadow).
- **Header bar**: dark gray (derived via `color-mix(in oklab,
  var(--sl-color-gray-6) 80%, transparent)`), padding `8px 12px`,
  traffic-light dots `#FF5F57 / #FEBC2E / #28C840` at 70 % opacity.
- **Tab pills**: centered in the header bar; active tab = light background
  + dark text; inactive = transparent + muted text; clickable `<button>`
  with `role="tab"`.
- **Copy button**: right-aligned in header bar, `<button>` with icon + label.
- **Body**: mono font (`--sl-font-system-mono`), `$` prompt in cyan
  `#7DD3FC`, commands in default text color, line-height 1.6.
- **Animated caret**: blinking block at the end of the last command line of
  the active tab, `1.5em × 1em`, 1 s pulse, disabled under
  `prefers-reduced-motion: reduce`.

### `HeroCommand.astro` (stays minimal)

Single inline line, no box, sits between the hero `<h1>` and the CTA
buttons.

```
$ npx @grove-dev/cli@latest new my-space    ⧉
```

- Mono `<code>`, `$` prefix in `--sl-color-text-accent`, copy button as a
  small icon to the right.
- No macOS chrome — would be visually loud at this position.

### `CtaCode.astro` (stays a pill)

The existing pill-shaped inline code, used in the final CTA section. Now
with a small copy button that appears on hover/focus.

```ts
// Visually: rounded pill, --sl-color-bg-inline-code background,
// command string centered, copy icon right-aligned, all inside one pill.
```

## Implementation

### Vanilla `<script>` islands

Each component that needs interactivity gets a `<script>` tag at the
bottom of its template. Astro 6 inlines these as ES modules (deferred by
default). The script scopes itself to its component via
`document.currentScript.previousElementSibling`.

**Tab switching** (in `CodeCard.astro`, ~30 lines):

```ts
const root = document.currentScript?.previousElementSibling as HTMLElement | null;
if (!root) throw new Error('CodeCard: root not found');
const tablist = root.querySelector('[role="tablist"]')!;
const panels = root.querySelectorAll('[role="tabpanel"]');

tablist.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
  if (!btn) return;
  const id = btn.getAttribute('aria-controls')!;
  tablist.querySelectorAll('[role="tab"]').forEach((t) =>
    t.setAttribute('aria-selected', String(t === btn))
  );
  panels.forEach((p) => (p as HTMLElement).hidden = p.id !== id);
});

tablist.addEventListener('keydown', (e) => {
  // arrow-key navigation per WAI-ARIA tabs pattern (left/right cycle,
  // home/end jump to first/last)
});
```

**Copy button** (in all three components, ~10 lines each, identical):

```ts
root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy!;
    const restore = btn.getAttribute('aria-label')!;
    try {
      await navigator.clipboard.writeText(text);
      btn.setAttribute('aria-label', 'Copied!');
    } catch {
      btn.setAttribute('aria-label', 'Copy failed');
    }
    setTimeout(() => btn.setAttribute('aria-label', restore), 1200);
  });
});
```

Each copy button renders with `data-copy={command}` (HeroCommand / CtaCode)
or `data-copy={commands.join('\n')}` (CodeCard).

**Animated caret** (in `CodeCard.astro` styles, ~5 lines):

```css
@keyframes grove-caret-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
.code-card-caret {
  animation: grove-caret-blink 1s steps(2, end) infinite;
  vertical-align: text-bottom;
}
@media (prefers-reduced-motion: reduce) {
  .code-card-caret { animation: none; }
}
```

### Styling principles

- Scoped `<style>` per component.
- Colors derived from existing `--sl-color-*` tokens via
  `color-mix(in oklab, var(--sl-color-X) Y%, transparent)` — same pattern as
  the current `HomeLanding.astro`.
- `prefers-reduced-motion: reduce` disables caret blink + any transitions.
- `prefers-color-scheme` works automatically via the Starlight theme tokens.

### Syntax color (minimal)

Only the `$` prompt gets color: cyan `#7DD3FC`. No per-token colorization,
no Shiki dependency. If per-token color is wanted later, it would be a
follow-up enhancement with its own spec.

## Accessibility

- Every interactive element is a real `<button type="button">`.
- Every copy button has `aria-label`, updates label on success / failure,
  restores the original label after 1.2 s.
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected` /
  `aria-controls`; panels use `role="tabpanel"` + `aria-labelledby` +
  `hidden`.
- Tabs are keyboard-navigable: ←/→ cycle, Home/End jump to first/last,
  Enter/Space activate (WAI-ARIA tabs pattern).
- Caret has `aria-hidden="true"` (decorative).
- Focus visible via `:focus-visible` outline using
  `--sl-color-text-accent`.
- All interactive elements work without JavaScript: copy buttons are
  server-rendered with the command in `data-copy`, tabs degrade to the
  first tab being shown (others `hidden`).

## Testing

Three new sibling test files, all using the substring-assertion pattern
that `docs/src/home-landing.test.ts` already uses:

- `docs/src/components/HeroCommand.test.ts`
  - asserts `$` prompt present
  - asserts the command string is in the rendered output
  - asserts the copy button has `data-copy="<command>"`

- `docs/src/components/CodeCard.test.ts`
  - asserts all 3 tab labels render
  - asserts the default tab (or first tab) is `aria-selected="true"`
  - asserts all commands of the default tab are present
  - asserts the copy button has all commands joined by `\n` in `data-copy`
  - asserts the caret element is present

- `docs/src/components/CtaCode.test.ts`
  - asserts the command string is present
  - asserts the copy button has `data-copy="<command>"`

`docs/src/home-landing.test.ts` does **not** require updates. Its existing
assertions (`command` string present, section headings present, feature
data present, no `powered-circuit` / `circuit-line`) all remain true after
migration:

- `command` is still defined in the frontmatter (still used by
  `HeroCommand` and `CtaCode`).
- The install-commands data still contains the literal
  `npx @grove-dev/cli@latest new my-space`.
- All section headings ("What Is Grove", "Get Started In Seconds",
  "Ecosystem", "Start building with Grove") remain in the template.
- Feature icons and stack-logo data are untouched.

The test continues to pass unchanged, but now exercises the same content
through the new components rather than through inline markup.

## Migration of `HomeLanding.astro`

**Frontmatter** (top of file):

```ts
import HeroCommand from './HeroCommand.astro';
import CodeCard from './CodeCard.astro';
import CtaCode from './CtaCode.astro';

const command = 'npx @grove-dev/cli@latest new my-space'; // unchanged

const installTabs = [
  { label: 'pnpm', commands: [
    'npx @grove-dev/cli@latest new my-space',
    'cd my-space',
    'pnpm install',
    'pnpm dev',
  ]},
  { label: 'npm', commands: [
    'npx @grove-dev/cli@latest new my-space',
    'cd my-space',
    'npm install',
    'npm run dev',
  ]},
  { label: 'bun', commands: [
    'npx @grove-dev/cli@latest new my-space',
    'cd my-space',
    'bun install',
    'bun dev',
  ]},
];
```

**Template** (3 replacements):

| Lines (current) | Before | After |
|---|---|---|
| 56–59 | inline `.hero-command` div | `<HeroCommand command={command} />` |
| 109–119 | inline `.code-card` with hardcoded `<pre><code>` | `<CodeCard tabs={installTabs} defaultTab="pnpm" />` |
| 200 | inline `<code>{command}</code>` in CTA | `<CtaCode command={command} />` |

**Scoped `<style>`**: remove the blocks that exclusively style those three
elements (≈120 lines total — `.hero-command` rules, `.code-card` rules,
the pill-style `.final-cta code` rule). Verified during implementation
that nothing else in the file depends on them.

## What stays unchanged

- `astro.config.mjs`
- `BaseLayout.astro`, `Header.astro`, `Sidebar.astro`, `Footer.astro`
- `src/styles/global.css`, all `--sl-*` tokens, dark/light theme swap
- All other sections of `HomeLanding.astro` (Hero text, What Is Grove,
  Ecosystem, Powered By, Final CTA prose, `.starter-preview`)
- The vitest config, `docs-config.test.ts`, all other test files

## Open questions resolved during implementation

1. **`<script>` hoisting** — Astro 6 hoists `<script>` tags by default and
   dedupes them. Implementation will place copy + tabs scripts at the
   bottom of each component template so they scope to
   `document.currentScript.previousElementSibling`. If hoisting causes
   scoping issues, fall back to `is:inline` with a manual IIFE.

2. **Caret position when tab switches** — the caret is the last child of
   the active `role="tabpanel"` (`.last-line > .caret`). When a tab is
   switched, the new panel becomes visible and its caret starts blinking.
   No animation reset needed (the blinking is infinite).

3. **TypeScript** — components use `.ts` snippets inside `<script>` tags.
   No sibling `.ts` files for component logic. The components themselves
   remain plain `.astro`.

## Risks

- **Clipboard API requires a secure context.** The docs site is served
  over HTTPS in production (`astro.config.mjs` `site: 'https://grove.dev'`)
  so this is fine in production. Local dev runs over `http://localhost`
  which is treated as secure by all modern browsers. Fallback: if
  `navigator.clipboard` is unavailable, the catch block sets
  `aria-label="Copy failed"` and the user can manually copy.
- **Astro script hoisting might break `document.currentScript` scoping.**
  Mitigation: switch to `is:inline` + IIFE pattern. Listed in Open
  Questions above.
- **Scope creep during migration.** Mitigation: the spec explicitly
  excludes everything except the three named inline displays. If a
  related style or selector is incidentally removed, restore it.

## Verification

After implementation:

1. `pnpm -C docs test` passes (new component tests + updated
   `home-landing.test.ts`).
2. `pnpm -C docs build` succeeds without warnings about unused styles or
   imports.
3. Manual smoke test in browser:
   - Click each tab in the code card → body switches, caret moves to new
     last line.
   - Click copy button on each display → "Copied!" label appears for ~1.2 s,
     then restores.
   - Tab through each interactive element → focus ring visible.
   - Toggle dark/light theme → all three displays stay readable.
   - Set `prefers-reduced-motion: reduce` in DevTools → caret stops
     blinking, copy button transitions disabled.
4. Visual regression check: HomeLanding.astro looks the same as before
   (hero, code card, CTA) plus the macOS frame and animated caret.