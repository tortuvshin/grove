/**
 * @grove-dev/astro — generic layout components.
 *
 * These layouts are the public, framework-agnostic shell used by
 * every consumer page. They:
 *
 *   - take a `site` prop (name, tagline, nav, repoUrl) instead of
 *     importing a `siteConfig` from a project-local path;
 *   - compose the standard Header / Footer / Seo / Container /
 *     SectionHeader / ThemeToggle components;
 *   - share the `grove-theme` localStorage key for theme state.
 *
 * Re-exported as ESM module names. Astro resolves the
 * `@grove-dev/astro/layouts/*` subpath import from `src/layouts/`
 * (the package's `dist/` only contains TypeScript helpers, not the
 * `.astro` files themselves).
 */
export { default as BaseLayout } from "./BaseLayout.astro";
export { default as Container } from "./Container.astro";
export { default as Footer } from "./Footer.astro";
export { default as Header } from "./Header.astro";
export { default as SectionHeader } from "./SectionHeader.astro";
export { default as Seo } from "./Seo.astro";
export { default as ThemeToggle } from "./ThemeToggle.astro";
