/**
 * Icon set invariants.
 *
 * These guard the class of bug that made the whole icon rewrite
 * necessary: an SVG whose baked-in color makes it invisible against
 * one of the two themes, and a name that resolves to a file nobody
 * shipped.
 *
 * Everything here reads the committed assets, so a hand-edited SVG or
 * a stale `pnpm icons:sync` fails locally without needing a build.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { ICON_KINDS } from "./lib/icon-kinds.js";
import { resolveIconAsset } from "./lib/icon-registry.js";

const root = resolve(import.meta.dirname, "../../..");
const packagedDir = resolve(root, "packages/astro/assets/icons");
const mirrorDir = resolve(root, "apps/example/public/icons");
const folders = ["stacks", "platforms"] as const;

function iconFiles(base: string): string[] {
  return folders.flatMap((folder) => {
    const dir = resolve(base, folder);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((entry) => entry.endsWith(".svg"))
      .map((entry) => `${folder}/${entry}`);
  });
}

const packagedFiles = iconFiles(packagedDir);
const read = (relativePath: string) => readFileSync(resolve(packagedDir, relativePath), "utf8");

describe("packaged icon set", () => {
  it("ships a file for every name the kind map classifies", () => {
    for (const key of Object.keys(ICON_KINDS)) {
      expect(existsSync(resolve(packagedDir, `${key}.svg`)), key).toBe(true);
    }
  });

  it("classifies every file it ships", () => {
    // An orphan SVG is a name nothing can reach — the state that left
    // `node.js.svg` and `chromeos.svg` lying around unreferenced.
    for (const file of packagedFiles) {
      expect(ICON_KINDS[file.replace(/\.svg$/, "")], file).toBeDefined();
    }
  });

  it("never bakes a color into a mono mark", () => {
    // A mono mark is painted by the page. A literal fill would be a
    // maintainer's false signal — and in a `<img>` fallback path it is
    // exactly what made the Apple mark white-on-white in light mode.
    const literalColor = /(fill|stroke)\s*[:=]\s*["']?#[0-9a-fA-F]{3,8}/;
    for (const [key, kind] of Object.entries(ICON_KINDS)) {
      if (kind !== "mono") continue;
      expect(read(`${key}.svg`), key).not.toMatch(literalColor);
    }
  });

  it("has no theme-variant files left", () => {
    // `-light`/`-dark` pairs were the old, JS-swapped theming model.
    // `currentColor` replaced them; this stops them creeping back.
    for (const base of [packagedDir, mirrorDir]) {
      for (const file of iconFiles(base)) {
        expect(file, file).not.toMatch(/-(light|dark)\.svg$/);
      }
    }
  });

  it("draws something in every mono mark", () => {
    // A mask with no drawable renders as an invisible blank, and
    // unlike `<img>` there is no `onerror` to catch it.
    for (const [key, kind] of Object.entries(ICON_KINDS)) {
      if (kind !== "mono") continue;
      expect(read(`${key}.svg`), key).toMatch(/<(path|rect|circle|polygon|ellipse)\b/);
    }
  });

  it("uses no <text> element", () => {
    // Text depends on a font the SVG rasterizer picks, renders as an
    // illegible smudge at 10–18px, and is dropped entirely by a mask
    // on some engines.
    for (const file of packagedFiles) {
      expect(read(file), file).not.toMatch(/<text\b/);
    }
  });

  it("embeds no external or executable content", () => {
    // Cheap supply-chain guard on vendored third-party artwork.
    for (const file of packagedFiles) {
      const svg = read(file);
      expect(svg, file).not.toMatch(/<(script|foreignObject|image)\b/);
      expect(svg, file).not.toMatch(/(xlink:)?href\s*=\s*["']https?:/);
    }
  });

  it("keeps the example site's copy byte-identical", () => {
    // `apps/example/public/icons` is the `grove init` scaffold. Drift
    // here is how the packaged set and shipped set diverged before.
    expect(iconFiles(mirrorDir).sort()).toEqual([...packagedFiles].sort());
    for (const file of packagedFiles) {
      expect(readFileSync(resolve(mirrorDir, file), "utf8"), file).toBe(read(file));
    }
  });

  it("resolves every taxonomy id to a shipped icon", () => {
    const cases: Array<[string, "stack" | "platform"]> = [
      ...taxonomyIds("stacks.yml").map((id) => [id, "stack" as const] as [string, "stack"]),
      ...taxonomyIds("platforms.yml").map(
        (id) => [id, "platform" as const] as [string, "platform"],
      ),
    ];
    expect(cases.length).toBeGreaterThan(0);
    for (const [id, category] of cases) {
      const asset = resolveIconAsset(id, category);
      if (asset.textOnly) continue;
      expect(ICON_KINDS[asset.key], `${category}:${id} → ${asset.key}`).toBeDefined();
    }
  });
});

function taxonomyIds(file: string): string[] {
  const path = resolve(root, "apps/example/data/taxonomy", file);
  const parsed = parseYaml(readFileSync(path, "utf8")) as
    | Array<{ id: string }>
    | Record<string, Array<{ id: string }>>;
  const entries = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
  return entries.map((entry) => entry.id);
}
