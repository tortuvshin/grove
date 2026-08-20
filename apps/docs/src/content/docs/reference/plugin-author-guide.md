---
title: Plugin author guide
description: Build Astro integrations, Vite plugins, and custom hooks on top of Grove.
---

`@grove-dev/astro` is a normal [Astro integration](https://docs.astro.build/en/reference/integrations-reference/).
Grove itself doesn't expose a plugin system beyond that — there's no separate "Grove plugin" API,
registry, or hook contract. Extension authors work with the same surface any Astro integration
author has:

1. **Write another Astro integration** that runs before or after `@grove-dev/astro` in the
   `integrations` array.
2. **Write a Vite plugin** and register it from your integration's `astro:config:setup` hook.
3. **Read `data/generated/*.json`** at build time (written by `@grove-dev/core`'s `prepareDirectory`)
   and emit custom pages from it.
4. **Ship a Starlight plugin** to extend the docs site — `@grove-dev/starlight`
   (`packages/starlight/`) is a real, in-repo example of exactly this.

## Astro integration

```ts
// my-integration/index.ts
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { loadConfig } from "@grove-dev/core";

export default function myIntegration(): AstroIntegration {
  return {
    name: "my-grove-integration",
    hooks: {
      "astro:config:setup": async ({ config, command, updateConfig, logger }) => {
        // Read the parsed grove.config.ts the same way @grove-dev/astro does.
        const siteConfig = await loadConfig(fileURLToPath(config.root));

        // Add Vite plugins
        updateConfig({
          vite: {
            plugins: [myVitePlugin(siteConfig)]
          }
        });

        // Inject routes
        // (see @astrojs/starlight for examples)
      },
      "astro:routes:resolved": async ({ routes }) => {
        // Iterate the full route map (Astro 5+)
      }
    }
  };
}
```

`loadConfig` and its counterpart `defineConfig` are both public exports of `@grove-dev/core`
(`packages/core/src/index.ts`); they're the same functions `@grove-dev/astro` itself calls to parse
`grove.config.ts`.

### Key hooks

| Hook | Purpose |
|---|---|
| `astro:config:setup` | Read config, register Vite plugins, add integrations |
| `astro:config:done` | Final config inspection |
| `astro:server:setup` | Dev-server lifecycle; add watch paths, register middleware |
| `astro:server:start` | Server started; inspect addresses |
| `astro:routes:resolved` | Full route map (Astro 5+); enumerate pages |
| `astro:route:setup` | Per-route setup before it's built; inspect or adjust one `route` at a time |
| `astro:build:done` | Build finished; inspect emitted `pages` and `assets` |

Reference: <https://docs.astro.build/en/reference/integrations-reference/>.

## Vite plugin

```ts
import type { Plugin } from "vite";

export function myVitePlugin(options): Plugin {
  return {
    name: "my-grove-vite-plugin",
    apply: "serve", // dev-only

    configureServer(server) {
      server.watcher.add("data/**/*.yml");
    },

    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".yml")) {
        // Let Vite's default HMR handling pick this up, or return `[]`
        // to suppress the update entirely — see the Vite reference below.
      }
    },

    config(config) {
      // Vite config overrides
      return {
        resolve: {
          alias: {
            "@my-grove": new URL("./runtime/", import.meta.url).pathname
          }
        }
      };
    }
  };
}
```

Reference: <https://vite.dev/guide/api-plugin>.

## Virtual modules

Vite plugins can expose server-computed data to client code via virtual modules. This is a generic
Vite technique for *your own* integration's data — Grove doesn't publish a virtual module that's
meant for third-party consumption. (Internally, `@grove-dev/astro` and `@grove-dev/starlight` each
register one virtual module of their own — `virtual:grove-consumer-global-css` and
`virtual:grove-starlight-config` respectively — but both are private wiring for those packages, not
a documented extension point.)

To do the same for your own integration's config:

```ts
// integration.ts
updateConfig({
  vite: {
    plugins: [
      {
        name: "my-virtual-module",
        resolveId(id) {
          if (id === "virtual:my-integration-config") return "\0" + id;
        },
        load(id) {
          if (id === "\0virtual:my-integration-config") {
            return `export default ${JSON.stringify(myConfig)}`;
          }
        }
      }
    ]
  }
});
```

In client code:

```ts
import myConfig from "virtual:my-integration-config";
```

## Codegen namespace

Astro's `astro:config:setup` hook passes a `createCodegenDir()` helper — call it with no arguments
from inside your own integration to get a `URL` for a directory under `.astro/` namespaced to your
integration's own `name`, instead of writing to `node_modules/.astro/` by hand:

```ts
"astro:config:setup": ({ createCodegenDir }) => {
  const dir = createCodegenDir(); // .astro/<your-integration-name>/
};
```

## Config schema

`groveConfigSchema` (`packages/core/src/schema.ts`) is **not** part of `@grove-dev/core`'s public
export surface — only `defineConfig`, `loadConfig`, and the `GroveConfig` / `GroveConfigInput` types
are exported from `@grove-dev/core`. There is currently no supported way to fork or extend the
config schema itself from outside the monorepo. If your integration needs its own configuration,
read it from a separate file or a namespaced key you parse yourself — don't rely on `grove.config.ts`
accepting fields Grove's own schema doesn't define, since unknown top-level keys are rejected (see
the `facets` → `browse.facets` migration note in [Migration guide](/reference/migration/) for what
that rejection looks like in practice).

## Best practices

- **Use `apply: "serve"`** for dev-only Vite plugins.
- **Use `enforce: "pre"`** for transform plugins.
- **Prefer `astro:routes:resolved`** over `astro:config:setup` for route enumeration.
- **Make plugins idempotent** — Vite calls hooks multiple times.
- **Use `createCodegenDir`** instead of writing to `node_modules/.astro/`.
- **Never write to `data/generated/`** — that's owned by `@grove-dev/core`.

## Related

- [Astro integration reference](https://docs.astro.build/en/reference/integrations-reference/)
- [Vite plugin API](https://vite.dev/guide/api-plugin)
- [Plugin API (Starlight)](/reference/plugin-api/)
