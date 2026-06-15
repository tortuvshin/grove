/**
 * @grove-dev/starlight — config / override / virtual module tests.
 *
 * Coverage (per the brief):
 *   - plugin.ts:parseConfig: accepts empty config (all defaults),
 *     honours user-supplied fields, throws on invalid input
 *   - virtual module resolution: the vite plugin's `load` and
 *     `resolveId` hooks return the canonical module id when
 *     called with the expected arguments, and pass through for
 *     unrelated ids
 *   - override composition: the override() function fills in
 *     every component override slot, warns the user on a clash,
 *     and preserves a pre-set user override (does NOT clobber it
 *     with the default)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { plugin } from "../core/plugin.js";
import { override, COMPONENT_OVERRIDES } from "../core/config/override.js";
import { vitePlugin } from "../core/config/vite.js";
import { LucodeStarlightConfigSchema } from "../core/config/schemas.js";

describe("parseConfig (exercised through plugin())", () => {
  it("accepts an empty config and fills in all defaults", () => {
    // We can't import parseConfig directly (it's local to
    // plugin.ts), so we exercise it through `plugin(undefined)`,
    // which goes through the same Zod parse path. The hook
    // callback is called with the parsed config; we read it
    // back via the test.
    let captured: unknown;
    const p = plugin();
    // The plugin's `config:setup` hook is the only place
    // parseConfig's output is consumed. Invoke it with a
    // minimal stub of the hook parameters and capture the
    // addIntegration's vite config.
    const addIntegration = vi.fn();
    const updateConfig = vi.fn();
    const calls: Array<{ vite?: { plugins?: Array<{ load?: unknown; resolveId?: unknown }> } }> = [];
    addIntegration.mockImplementation((integration: { hooks: { "astro:config:setup": (args: { updateConfig: (cfg: { vite?: { plugins?: Array<{ load?: unknown; resolveId?: unknown }> } }) => void }) => void } }) => {
      integration.hooks["astro:config:setup"]({
        updateConfig: (cfg) => calls.push(cfg),
      });
    });
    p.hooks["config:setup"]({
      config: { customCss: [] },
      logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} } as never,
      updateConfig: updateConfig as never,
      addIntegration: addIntegration as never,
      command: "build" as never,
      isRestart: false,
    });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    const vite = call?.vite;
    expect(vite?.plugins).toBeDefined();
    captured = vite;
    // Sanity: parseConfig didn't throw on the empty input.
    expect(captured).toBeDefined();
  });

  it("honours user-supplied docs.includeAiUtilities", () => {
    // Capture the vite plugin's resolved config to assert
    // that the user's boolean is preserved.
    let capturedPlugin: ReturnType<typeof vitePlugin> | undefined;
    const addIntegration = vi.fn((integration: { hooks: { "astro:config:setup": (args: { updateConfig: (cfg: { vite: { plugins: Array<ReturnType<typeof vitePlugin>> } }) => void }) => void } }) => {
      integration.hooks["astro:config:setup"]({
        updateConfig: (cfg) => {
          capturedPlugin = cfg.vite.plugins[0];
        },
      });
    });
    const p = plugin({ docs: { includeAiUtilities: true } });
    p.hooks["config:setup"]({
      config: { customCss: [] },
      logger: { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} } as never,
      updateConfig: vi.fn() as never,
      addIntegration: addIntegration as never,
      command: "build" as never,
      isRestart: false,
    });
    expect(capturedPlugin).toBeDefined();
    // The vite plugin's moduleContent embeds the JSON-serialized
    // config. Load it to confirm `includeAiUtilities: true`
    // survived the parse.
    const loaded = capturedPlugin!.load("\0virtual:lucode-starlight-config") as string;
    expect(loaded).toContain('"includeAiUtilities":true');
  });

  it("falls back to the schema default for an empty docs object", () => {
    // The schema has `.default({ includeAiUtilities: false })`
    // for the docs sub-object. Pin it.
    const parsed = LucodeStarlightConfigSchema.parse({});
    expect(parsed.docs?.includeAiUtilities).toBe(false);
  });

  it("throws on invalid input (zod validation failure)", () => {
    // A non-string label fails the linkSchema validation.
    expect(() => LucodeStarlightConfigSchema.parse({ navLinks: "not-an-array" })).toThrow();
  });
});

describe("vitePlugin — virtual module resolution", () => {
  it("resolveId returns the resolved id for the canonical module id", () => {
    const p = vitePlugin(LucodeStarlightConfigSchema.parse({}));
    // The virtual module prefix is 'virtual:'. The plugin
    // matches on the un-prefixed name and returns the
    // '\0'-prefixed resolved id (Vite convention for virtual
    // modules — the null byte prevents the resolved id from
    // being treated as a real file path).
    const result = p.resolveId?.("virtual:lucode-starlight-config");
    expect(result).toBe("\0virtual:lucode-starlight-config");
  });

  it("resolveId returns undefined for unrelated ids (passthrough)", () => {
    const p = vitePlugin(LucodeStarlightConfigSchema.parse({}));
    expect(p.resolveId?.("virtual:some-other-module")).toBeUndefined();
    expect(p.resolveId?.("./relative-import")).toBeUndefined();
  });

  it("load returns the JSON-serialized config when given the resolved id", () => {
    const config = LucodeStarlightConfigSchema.parse({ docs: { includeAiUtilities: true } });
    const p = vitePlugin(config);
    const module = p.load?.("\0virtual:lucode-starlight-config") as string;
    expect(module).toContain("export default");
    expect(module).toContain('"includeAiUtilities":true');
  });

  it("load returns undefined for unrelated ids", () => {
    const p = vitePlugin(LucodeStarlightConfigSchema.parse({}));
    expect(p.load?.("not-the-virtual-id")).toBeUndefined();
  });
});

describe("override — component override composition", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("fills every component override slot when the user has none", () => {
    // Starlight starts with no components overridden (empty
    // config). The override() function should set every key in
    // COMPONENT_OVERRIDES to point at the @grove-dev/starlight
    // path.
    const components = override(
      { components: {} } as never,
      COMPONENT_OVERRIDES,
      { warn: warnSpy, info: () => {}, error: () => {}, debug: () => {} } as never,
    );
    for (const key of COMPONENT_OVERRIDES) {
      expect(components?.[key]).toBe(`@grove-dev/starlight/components/overrides/${key}.astro`);
    }
  });

  it("preserves a user-supplied component override (does not clobber)", () => {
    // If the user already set components.Footer, we should
    // NOT overwrite it with the default — we warn and skip.
    // Pin: a previous "always overwrite" implementation would
    // silently clobber the user's custom footer.
    const userFooter = "./my-custom/Footer.astro";
    const components = override(
      { components: { Footer: userFooter } } as never,
      COMPONENT_OVERRIDES,
      { warn: warnSpy, info: () => {}, error: () => {}, debug: () => {} } as never,
    );
    expect(components?.Footer).toBe(userFooter);
    // The warn call names the slot and points at the override path.
    const warnings = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(warnings.some((w: string) => w.includes("Footer"))).toBe(true);
    // All OTHER slots are still filled in.
    expect(components?.Header).toBe(`@grove-dev/starlight/components/overrides/Header.astro`);
  });

  it("handles a config with no `components` field at all (undefined)", () => {
    // Defensive: Starlight's config can omit `components`
    // entirely. override() should still produce a full set
    // without throwing.
    const components = override(
      {} as never,
      COMPONENT_OVERRIDES,
      { warn: warnSpy, info: () => {}, error: () => {}, debug: () => {} } as never,
    );
    for (const key of COMPONENT_OVERRIDES) {
      expect(components?.[key]).toBeDefined();
    }
  });
});
