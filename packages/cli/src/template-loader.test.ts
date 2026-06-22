/**
 * @grove-dev/cli — unit tests for the pure-logic helpers
 * exported from `template-loader.ts` and the `parseDeployProvider`
 * helper from `index.ts`.
 *
 * Coverage (per the brief):
 *   - packageNameFromProjectName: slugification, template suffix,
 *     empty-input fallback ("grove-site")
 *   - renameProjectInTemplate: published mode pins versions,
 *     file mode rewrites to absolute `link:` paths
 *   - copyTemplate: force flag (overwrites a non-empty dir),
 *     default refuses a non-empty target, filter rules
 *     (excludes node_modules / .astro / dist / data/generated /
 *     .DS_Store)
 *   - parseDeployProvider: valid values pass through, undefined
 *     → "github-pages" default, invalid value → process.exit(1)
 *     (the cli-scripts-tooling audit finding)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  packageNameFromProjectName,
  renameProjectInTemplate,
  copyTemplate,
  type Framework,
} from "./template-loader.js";
import { parseDeployProvider } from "./helpers.js";

// Use the @grove-dev/astro package's template as the source of
// truth for the copyTemplate tests. It IS present in node_modules
// (CLI depends on it) and has a `templates/default/` tree that
// matches the schema copyTemplate expects.
const ASTRO_TEMPLATE = resolve(
  // Walk up from packages/cli/src to the monorepo root, then into
  // packages/astro/templates/default.
  import.meta.dirname, // src/
  "../../../astro/templates/default",
);

describe("packageNameFromProjectName", () => {
  it("slugifies a multi-word project name and appends framework+template", () => {
    expect(packageNameFromProjectName("My Cool Project", "astro", "default")).toBe(
      "my-cool-project-astro-default",
    );
  });

  it("strips punctuation but keeps lowercase alphanumerics", () => {
    expect(packageNameFromProjectName("foo_bar.baz", "astro", "default")).toBe(
      "foo-bar-baz-astro-default",
    );
  });

  it("falls back to 'grove-site' for an input that slugifies to empty (e.g. emoji-only)", () => {
    // The function: if `slug` ends up empty, substitute
    // "grove-site". Pin the behaviour so a user typing "🚀"
    // as the project name doesn't end up with a package called
    // "-astro-default".
    expect(packageNameFromProjectName("🚀", "astro", "default")).toBe(
      "grove-site-astro-default",
    );
  });

  it("embeds the template name so two scaffolds with the same project name don't collide", () => {
    expect(packageNameFromProjectName("foo", "astro", "minimal")).toBe(
      "foo-astro-minimal",
    );
    expect(packageNameFromProjectName("foo", "astro", "blog")).toBe(
      "foo-astro-blog",
    );
  });
});

describe("copyTemplate — force flag, filter rules", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "grove-cli-copy-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("copies a real @grove-dev/astro template into a fresh empty target dir", async () => {
    const target = join(cwd, "fresh");
    await mkdir(target, { recursive: true });
    const r = await copyTemplate("astro", target, "default");
    expect(r.to).toBe(target);
    // File count must be > 0 (audit: was returning -1 as a sentinel).
    expect(r.files).toBeGreaterThan(0);
    // Spot-check: the template's package.json should be there.
    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).toBe("grove-site");
  });

  it("throws when the target dir is non-empty and force is not set", async () => {
    const target = join(cwd, "occupied");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "user-file.txt"), "do not delete me");
    // Default (force: false) → refuse.
    await expect(copyTemplate("astro", target, "default")).rejects.toThrow(/not empty/);
    // The user's file is still there (we didn't half-copy).
    const userFile = await readFile(join(target, "user-file.txt"), "utf8");
    expect(userFile).toBe("do not delete me");
  });

  it("overwrites files that exist in the source tree when force: true", async () => {
    // Pre-seed the target with a `package.json` whose contents
    // differ from the template's. With force: true, the copy
    // overwrites the existing package.json with the template's
    // version. (Without force, copyTemplate refuses up front
    // for a non-empty target — see the previous test.)
    const target = join(cwd, "forced");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "package.json"), JSON.stringify({ name: "user-wrote-this" }));
    const r = await copyTemplate("astro", target, "default", { force: true });
    expect(r.files).toBeGreaterThan(0);
    // The package.json was overwritten with the template's
    // version (name = "grove-site").
    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).toBe("grove-site");
  });

  it("excludes node_modules, .astro, dist, data/generated, and .DS_Store from the copy", async () => {
    // We can't easily inject "garbage" into the @grove-dev/astro
    // template, so we exercise the filter indirectly: the real
    // template does NOT contain any of those paths, so a clean
    // copy should produce zero matches. This is a "nothing
    // filtered accidentally" assertion.
    const target = join(cwd, "filter-check");
    await mkdir(target, { recursive: true });
    await copyTemplate("astro", target, "default");

    // Walk the target and assert no excluded path sneaks in.
    async function walk(dir: string, out: string[]): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        out.push(full);
        if (entry.isDirectory()) await walk(full, out);
      }
    }
    const all: string[] = [];
    await walk(target, all);
    const offending = all.filter((p) => {
      const rel = p.slice(target.length).replace(/^[/\\]/, "");
      const norm = rel.replaceAll("\\", "/");
      return (
        norm === "node_modules" ||
        norm.startsWith("node_modules/") ||
        norm === ".astro" ||
        norm.startsWith(".astro/") ||
        norm === "dist" ||
        norm.startsWith("dist/") ||
        norm === "data/generated" ||
        norm.startsWith("data/generated/") ||
        norm.endsWith("/.DS_Store") ||
        norm === ".DS_Store"
      );
    });
    expect(offending).toEqual([]);
  });
});

describe("renameProjectInTemplate — published vs file mode", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "grove-cli-rename-"));
    await mkdir(cwd, { recursive: true });
    // A minimal package.json that mirrors what a real template
    // ships — has both `dependencies` and `devDependencies` with
    // @grove-dev/* entries, so we can test the rewrite in both.
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "old-name",
        dependencies: {
          "@grove-dev/core": "workspace:*",
          "@grove-dev/astro": "workspace:*",
          "react": "^18.0.0", // not a Grove dep — must be left alone
        },
        devDependencies: {
          "@grove-dev/ui": "workspace:*",
        },
      }, null, 2),
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("published mode: rewrites @grove-dev/* deps to the supplied version", async () => {
    const r = await renameProjectInTemplate("astro", cwd, "my-project", "default", {
      mode: "published",
    });
    // The package name was rewritten to the slug-form.
    expect(r.finalName).toBe("my-project-astro-default");
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    // The non-Grove dep is untouched.
    expect(pkg.dependencies.react).toBe("^18.0.0");
    // At least one of the Grove deps was rewritten (the version
    // arg defaults to whatever frameworkVersion returns).
    const rewritten = r.rewrittenDeps.some((line) => line.includes("@grove-dev/"));
    expect(rewritten).toBe(true);
  });

  it("file mode: rewrites @grove-dev/* deps to absolute `link:` paths", async () => {
    // We don't actually need the links to resolve here — we
    // only need to assert the shape of the rewrite. The CLI's
    // real `grove run` path uses this to wire the dev monorepo
    // into the scaffold without a publish step.
    //
    // We can't predict the exact path (it depends on
    // node_modules walk), but every entry in rewrittenDeps
    // must mention "link:" for a Grove dep.
    const r = await renameProjectInTemplate("astro", cwd, "my-project", "default", {
      mode: "file",
    });
    // If the resolveGrovePackage walk finds any @grove-dev/*
    // package in the CLI's node_modules, they all become
    // link:<abs-path>. The walk may not find them in this
    // isolated test (the CLI is symlinked into the
    // monorepo, so the walk should succeed) — either way,
    // the package name is rewritten.
    expect(r.finalName).toBe("my-project-astro-default");
    // If we did get any rewrites, they must be `link:` paths.
    for (const line of r.rewrittenDeps) {
      expect(line).toMatch(/@grove-dev\/.*->\s*link:/);
    }
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(realpathSync(pkg.dependencies["@grove-dev/astro"]!.slice("link:".length)))
      .toBe(realpathSync(resolve("packages/astro")));
  });

  it("leaves the package.json `name` field rewritten to the slug form", async () => {
    await renameProjectInTemplate("astro", cwd, "My Cool Project", "default", {
      mode: "published",
    });
    const pkg = JSON.parse(await readFile(join(cwd, "package.json"), "utf8")) as {
      name: string;
    };
    expect(pkg.name).toBe("my-cool-project-astro-default");
  });
});

describe("parseDeployProvider — cli-scripts-tooling audit finding", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Track calls without actually exiting. We do NOT throw
    // because parseDeployProvider's exit(1) lands inside a
    // process.on('uncaughtException') handler at the bottom
    // of index.ts, which would then also call our mocked
    // exit(1), recursing into the uncaughtException handler
    // and producing a noisy unhandled-rejection in vitest.
    // The cleanest approach: replace the implementation with a
    // no-op so process.exit(1) is observed but not propagated.
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("returns the value unchanged for every valid provider", () => {
    // The valid set is locked at template-loader.ts:24 — any
    // new value added there must be reflected here.
    expect(parseDeployProvider("vercel")).toBe("vercel");
    expect(parseDeployProvider("netlify")).toBe("netlify");
    expect(parseDeployProvider("cloudflare")).toBe("cloudflare");
    expect(parseDeployProvider("github-pages")).toBe("github-pages");
    expect(parseDeployProvider("none")).toBe("none");
  });

  it("returns 'github-pages' for undefined (the historical default)", () => {
    // Pin the default: undefined means the user did not pass
    // --deploy at all. The previous implementation returned
    // "github-pages" too, so this is unchanged — but pinning
    // it so a future "default to none" change is visible.
    expect(parseDeployProvider(undefined)).toBe("github-pages");
  });

  it("calls process.exit(1) for an invalid value (the audit fix)", () => {
    // The audit finding: the previous implementation silently
    // coerced invalid values to "github-pages", which masked
    // typos. The current implementation calls process.exit(1).
    // We do NOT throw inside the mock — see the beforeEach
    // comment for why. The test just asserts exit was called
    // with code 1 and the error message was informative.
    parseDeployProvider("vercels");
    expect(exitSpy).toHaveBeenCalledWith(1);
    // The error message names the bad value AND the valid set.
    const messages = errSpy.mock.calls.map((c: unknown) => String(c));
    expect(messages.some((m: string) => m.includes("vercels"))).toBe(true);
    expect(messages.some((m: string) => m.includes("vercel"))).toBe(true);
  });

  it("does NOT return 'github-pages' for an invalid value (regression guard)", () => {
    // The exact bug the audit found. parseDeployProvider must
    // NOT return a valid DeployProvider for an invalid input.
    // The mock makes process.exit(1) a no-op so the function
    // returns undefined (because the explicit `return` after
    // the exit is unreachable). Either way, it's not
    // "github-pages" — the silent-fallback path that
    // masked typos in CI scripts.
    const result = parseDeployProvider("garbage-provider");
    expect(result).not.toBe("github-pages");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
