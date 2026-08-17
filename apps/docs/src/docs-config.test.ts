import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");

describe("docs Astro config", () => {
  it("uses the local Starlight plugin and existing stylesheet", async () => {
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );

    expect(config).toContain("import grove from '@grove-dev/starlight'");
    expect(config).toContain("customCss: ['./src/styles/global.css']");
    expect(config).toContain("grove({");
    expect(config).not.toContain("starlightLinksValidator(");
    expect(config).not.toContain("starlightOpenInGH(");
    expect(config).not.toContain("starlightAi(");
    expect(config).not.toContain("./src/styles/custom.css");
  });

  it("declares 7 sidebar sections matching the IA redesign", async () => {
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );

    const sectionLabels = [
      "Start here",
      "Guides",
      "Walkthroughs",
      "Customize",
      "Reference",
      "Advanced",
      "Resources",
    ];
    for (const label of sectionLabels) {
      expect(config, `sidebar section "${label}" missing`).toContain(
        `label: '${label}'`,
      );
    }
  });
});

describe("docs sidebar coverage", () => {
  async function* walk(dir: string): AsyncGenerator<string> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walk(full);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
        yield full;
      }
    }
  }

  it("every content file under apps/docs/src/content/docs is referenced from sidebar or navLinks", async () => {
    const docsRoot = resolve(repoRoot, "apps/docs/src/content/docs");
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );

    const slugRe = /\bslug:\s*['"]([^'"]+)['"]/g;
    const slugs = [...config.matchAll(slugRe)].map((m) => m[1]);
    const navRe = /\blink:\s*['"]\/([^'"]+)\/['"]/g;
    const navLinks = [...config.matchAll(navRe)].map((m) => m[1]);

    const referenced = new Set([
      ...slugs.flatMap((slug) => [`${slug}.md`, `${slug}.mdx`]),
      ...navLinks.flatMap((slug) => [`${slug}.md`, `${slug}.mdx`]),
    ]);

    const orphans: string[] = [];
    for await (const file of walk(docsRoot)) {
      const rel = relative(docsRoot, file);
      if (!referenced.has(rel)) {
        orphans.push(rel);
      }
    }

    expect(
      orphans,
      `orphans must be added to the sidebar or removed: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("every sidebar slug resolves to an existing file", async () => {
    const docsRoot = resolve(repoRoot, "apps/docs/src/content/docs");
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );
    const slugRe = /\bslug:\s*['"]([^'"]+)['"]/g;
    const slugs = [...config.matchAll(slugRe)].map((m) => m[1]);

    const missing: string[] = [];
    for (const slug of slugs) {
      if (slug.startsWith("http")) continue;
      const md = join(docsRoot, `${slug}.md`);
      const mdx = join(docsRoot, `${slug}.mdx`);
      try {
        await stat(md);
      } catch {
        try {
          await stat(mdx);
        } catch {
          missing.push(slug);
        }
      }
    }

    expect(
      missing,
      `slugs must point to existing files: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});