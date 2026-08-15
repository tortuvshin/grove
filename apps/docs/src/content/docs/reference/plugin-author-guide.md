---
title: Plugin author guide
description: Build Astro integrations, Vite plugins, and custom hooks on top of Grove.
---

Grove exposes its surface as a small set of public functions plus an Astro integration. Extension authors can:

1. **Write an Astro integration** that runs before or after `@grove-dev/astro`.
2. **Write a Vite plugin** that augments the dev server.
3. **Read `data/generated/*.json`** at build time and emit custom pages.
4. **Ship a Starlight plugin** to extend the docs site (see `@grove-dev/starlight`).

## Astro integration

```ts
// my-integration/index.ts
import type { AstroIntegration } from "astro";

export default function myIntegration(options): AstroIntegration {
  return {
    name: "my-grove-integration",
    hooks: {
      "astro:config:setup": async ({ config, command, updateConfig, logger }) => {
        // Read generated config
        const { default: siteConfig } = await import("virtual:my-grove-config");

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

### Key hooks

| Hook | Purpose |
|---|---|
| `astro:config:setup` | Read config, register Vite plugins, add integrations |
| `astro:config:done` | Final config inspection |
| `astro:server:setup` | Dev-server lifecycle; add watch paths, register middleware |
| `astro:server:start` | Server started; inspect addresses |
| `astro:routes:resolved` | Full route map (Astro 5+); enumerate pages |
| `astro:page:setup` | Per-page setup; access `frontmatter`, `params` |

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

    async handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".yml")) {
        await invalidateGroveCache(ctx.file);
        await ctx.server.reloadModule();
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

Expose server-side data to client code via virtual modules:

```ts
// integration.ts
updateConfig({
  vite: {
    plugins: [
      {
        name: "my-virtual-module",
        resolveId(id) {
          if (id === "virtual:my-grove-config") return id;
        },
        load(id) {
          if (id === "virtual:my-grove-config") {
            return `export default ${JSON.stringify(config)}`;
          }
        }
      }
    ]
  }
});
```

In client code:

```ts
import siteConfig from "virtual:my-grove-config";
```

## Codegen namespaces

Use `createCodegenDir("my-grove")` to give your integration its own codegen namespace — useful when emitting types or runtime data files. Mirrors what `@astrojs/starlight` does internally.

## Schema extension

Grove's config schema is **closed**. To extend it, fork `groveConfigSchema` in your integration and provide your own `defineConfig` wrapper:

```ts
import { groveConfigSchema } from "@grove-dev/core";
import { z } from "zod";

export const myConfigSchema = groveConfigSchema.extend({
  myCustomKey: z.object({
    setting: z.string()
  })
});

export function defineConfig(input: z.infer<typeof myConfigSchema>) {
  return myConfigSchema.parse(input);
}
```

Document the extension in your README; users opt in by importing your `defineConfig` instead of Grove's.

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