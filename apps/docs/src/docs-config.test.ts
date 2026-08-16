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

  it("orders the sidebar as one learning path", async () => {
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );

    // The old grouping was by artifact kind — Sources, Generated Outputs,
    // Automation — which reads as a table of contents for the codebase.
    // These are ordered by what a reader needs next.
    const sectionLabels = [
      "Start here",
      "Build a knowledge site",
      "Publish everywhere",
      "Keep it useful",
      "Customize",
      "Deployment",
      "Reference",
      "Starlight theme",
      "Project",
      "Maintainers",
    ];
    for (const label of sectionLabels) {
      expect(config, `sidebar section "${label}" missing`).toContain(
        `label: '${label}'`,
      );
    }

    // Order matters as much as membership: a reader scanning the sidebar
    // should meet them in this sequence.
    const positions = sectionLabels.map((l) => config.indexOf(`label: '${l}'`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps the Starlight theme and maintainer docs out of the main path", async () => {
    const config = await readFile(
      resolve(repoRoot, "apps/docs/astro.config.mjs"),
      "utf8",
    );

    // Both are real documentation, but neither is what someone evaluating
    // Grove came to read — the theme showcase in particular made the
    // product look like an Astro theme.
    for (const label of ["Starlight theme", "Maintainers", "Deployment"]) {
      const at = config.indexOf(`label: '${label}'`);
      const collapsedAt = config.indexOf("collapsed: true", at);
      expect(collapsedAt, `"${label}" should be collapsed`).toBeGreaterThan(at);
      expect(collapsedAt - at).toBeLessThan(200);
    }
  });
});

/**
 * The files Astro will actually resolve for a sidebar slug.
 *
 * A section landing page is idiomatically `<section>/index.md`, which
 * Starlight routes at `/<section>/`. Checking only `<slug>.md` reports a
 * false orphan for the file and a false missing-slug for the section.
 */
const candidatesFor = (slug: string) => [
  `${slug}.md`,
  `${slug}.mdx`,
  `${slug}/index.md`,
  `${slug}/index.mdx`,
];

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
      ...slugs.flatMap(candidatesFor),
      ...navLinks.flatMap(candidatesFor),
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
      const found = await Promise.all(
        candidatesFor(slug).map((rel) =>
          stat(join(docsRoot, rel)).then(
            () => true,
            () => false,
          ),
        ),
      );
      if (!found.some(Boolean)) missing.push(slug);
    }

    expect(
      missing,
      `slugs must point to existing files: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});