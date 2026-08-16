// SPDX-License-Identifier: MIT
/**
 * Icon registry source table — the input to `scripts/sync-icons.mjs`.
 *
 * Each entry maps a Grove icon name to the upstream artwork it is
 * vendored from, plus the `kind` that decides how `Icon.astro`
 * renders it:
 *
 *   - `color` → `<img>`, painted with the brand's own palette
 *   - `mono`  → CSS-masked `<span>` painted `currentColor`, so it
 *               follows the surrounding text in light and dark
 *
 * Sources:
 *
 *   simple-icons:<name>  @iconify-json/simple-icons  (CC0-1.0)
 *   logos:<name>         @iconify-json/logos         (CC0-1.0)
 *   local:<name>         scripts/icons/local/<name>.svg
 *
 * ## Choosing `kind`
 *
 * **If the brand has a colour mark, use it.** `color` is the default,
 * and it holds even when contrast is imperfect (JavaScript's yellow,
 * Bun's cream, Django's near-black green) — the tiles carry a border,
 * and the silhouette is the recognisable part. Do not trade a brand's
 * colour for guaranteed contrast.
 *
 * `mono` is only for marks that have **no colour to lose**: Apple,
 * Rust, Tauri, Solidity, Deno. Those brands publish one flat shape and
 * present it black on light backgrounds and white on dark ones, which
 * is exactly what `mono` reproduces — so it is the faithful rendering,
 * not a fallback. Pinning them to a single literal colour is what made
 * them invisible in one theme.
 *
 * Concept glyphs (`web`, `desktop`, `llm`, …) have no brand at all
 * and are always `mono`.
 *
 * ## Choosing the upstream name
 *
 * Prefer `logos:` `-icon` variants: the bare name is often a lockup
 * with the wordmark (`logos:firebase` is 512x136, `logos:go` is
 * 512x192, `logos:svelte-kit` is 512x92), which shrinks to an
 * illegible smear in a 16px square.
 */

/** @typedef {{ source: string, kind: "color" | "mono", note?: string }} IconSource */

/** @type {{ stacks: Record<string, IconSource>, platforms: Record<string, IconSource> }} */
export default {
  stacks: {
    android: { source: "logos:android-icon", kind: "color" },
    apple: { source: "simple-icons:apple", kind: "mono" },
    bun: { source: "logos:bun", kind: "color" },
    capacitor: { source: "logos:capacitorjs-icon", kind: "color" },
    clojure: { source: "logos:clojure", kind: "color" },
    dart: { source: "logos:dart", kind: "color" },
    // Deno's own logo is monochrome — a black disc with a white dino,
    // which Deno inverts on dark backgrounds. `logos:deno` only ships
    // the light-mode artwork (its disc has no fill and the dino is
    // #fff), so it would vanish on white. `mono` reproduces both
    // presentations from one file.
    deno: { source: "simple-icons:deno", kind: "mono" },
    django: { source: "logos:django-icon", kind: "color" },
    docker: { source: "logos:docker-icon", kind: "color" },
    firebase: { source: "logos:firebase-icon", kind: "color" },
    flutter: { source: "logos:flutter", kind: "color" },
    // `logos:go` is the 512x192 wordmark lockup; `logos:gopher` is the
    // mascot on its own, which is what reads in a square.
    go: { source: "logos:gopher", kind: "color" },
    graphql: { source: "logos:graphql", kind: "color" },
    ionic: { source: "logos:ionic-icon", kind: "color" },
    java: { source: "logos:java", kind: "color" },
    javascript: { source: "logos:javascript", kind: "color" },
    kotlin: { source: "logos:kotlin-icon", kind: "color" },
    llm: { source: "local:llm", kind: "mono" },
    mongodb: { source: "logos:mongodb-icon", kind: "color" },
    nodejs: { source: "logos:nodejs-icon", kind: "color" },
    python: { source: "logos:python", kind: "color" },
    rag: { source: "local:rag", kind: "mono" },
    react: { source: "logos:react", kind: "color" },
    // React Native has no mark of its own — it uses the React atom.
    "react-native": { source: "logos:react", kind: "color" },
    rust: { source: "simple-icons:rust", kind: "mono" },
    solidity: { source: "simple-icons:solidity", kind: "mono" },
    // `logos:svelte-kit` is a 512x92 wordmark; the square Svelte mark
    // is what reads at 16px.
    sveltekit: { source: "logos:svelte-icon", kind: "color" },
    swift: { source: "logos:swift", kind: "color" },
    tauri: { source: "simple-icons:tauri", kind: "mono" },
    tensorflow: { source: "logos:tensorflow", kind: "color" },
    typescript: { source: "logos:typescript-icon", kind: "color" },
    vue: { source: "logos:vue", kind: "color" },
  },

  platforms: {
    android: { source: "logos:android-icon", kind: "color" },
    app: { source: "local:app", kind: "mono" },
    chrome: { source: "logos:chrome", kind: "color" },
    desktop: { source: "local:desktop", kind: "mono" },
    embedded: { source: "local:embedded", kind: "mono" },
    // `ios` and `macos` deliberately ship as their own files rather
    // than aliasing to one `apple.svg`: alias resolution runs before
    // the file lookup, so an alias would silently bypass a consumer's
    // own `public/icons/platforms/ios.svg`.
    ios: { source: "simple-icons:apple", kind: "mono" },
    macos: { source: "simple-icons:apple", kind: "mono" },
    linux: { source: "logos:linux-tux", kind: "color" },
    ubuntu: { source: "logos:ubuntu", kind: "color" },
    web: { source: "local:web", kind: "mono" },
    windows: { source: "logos:microsoft-windows-icon", kind: "color" },
  },
};
