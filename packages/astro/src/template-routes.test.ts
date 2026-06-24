import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagesDir = resolve(import.meta.dirname, "../templates/default/src/pages");

describe("default Astro route configuration", () => {
  it("ships TypeScript settings that resolve package exports and Node built-ins", async () => {
    const templateRoot = resolve(pagesDir, "../..");
    const tsconfig = JSON.parse(
      await readFile(resolve(templateRoot, "tsconfig.json"), "utf8"),
    ) as {
      extends?: string;
      compilerOptions?: {
        moduleResolution?: string;
        types?: string[];
      };
    };
    const manifest = JSON.parse(
      await readFile(resolve(templateRoot, "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };

    expect(tsconfig.extends).toBe("astro/tsconfigs/base");
    expect(tsconfig.compilerOptions?.moduleResolution).toBe("Bundler");
    expect(tsconfig.compilerOptions?.types).toContain("node");
    expect(manifest.devDependencies?.["@types/node"]).toMatch(/^\^/);
  });

  it("treats generated JSON as an untyped boundary before applying payload types", async () => {
    const recordsModule = await readFile(
      resolve(pagesDir, "../data/records.ts"),
      "utf8",
    );

    expect(recordsModule).toContain(
      "fullPayload as unknown as FullPayload",
    );
  });

  it("derives the directory route from generated site config", async () => {
    const listPage = await readFile(resolve(pagesDir, "[slug]/index.astro"), "utf8");

    expect(listPage).toContain("siteConfig.blueprintConfig?.routeSlug");
  });

  it("does not generate the legacy apps alias when apps is canonical", async () => {
    const aliasPage = await readFile(resolve(pagesDir, "apps/[recordSlug].astro"), "utf8");

    expect(aliasPage).toContain('if (indexSlug() === "apps")');
    expect(aliasPage).toContain("return []");
  });

  it("renders consumer-authored about Markdown through the default page", async () => {
    const aboutPage = await readFile(resolve(pagesDir, "about.astro"), "utf8");

    expect(aboutPage).toContain('getPageContentHtml("about")');
  });

  it("generates submission drafts accepted by the Grove record schema", async () => {
    const submitPage = await readFile(resolve(pagesDir, "submit.astro"), "utf8");

    expect(submitPage).toContain('"  type: manual"');
    expect(submitPage).not.toContain('"  type: github"');
  });

  it("builds full LLM URLs from generated consumer config", async () => {
    const script = await readFile(
      resolve(pagesDir, "../../scripts/build-llms.mjs"),
      "utf8",
    );

    expect(script).toContain("site-config.json");
    expect(script).toContain("blueprintConfig?.routeSlug");
  });
});
