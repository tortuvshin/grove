/**
 * Structural invariants for the "Powered by Grove" attribution.
 *
 * The mark is inlined rather than served as a file so it inherits
 * `currentColor` — the same reason the packaged icon set stopped
 * shipping light/dark pairs in 0.5.3. A baked hex here would
 * reintroduce a mark that is invisible in one theme, and no unit test
 * renders both themes, so the invariant is asserted on the source.
 *
 * The built-output half requires a prior `pnpm build` of
 * `apps/example` (same convention as page-parity / quality-gates) and
 * skips when `dist/` is absent.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const dist = resolve(root, "apps/example/dist");

const poweredBySource = readFileSync(
  resolve(import.meta.dirname, "components/PoweredBy.astro"),
  "utf8",
);
const footerSource = readFileSync(
  resolve(import.meta.dirname, "layouts/Footer.astro"),
  "utf8",
);
/** Markup only — the frontmatter's prose mentions `<img src>` on purpose. */
const poweredByTemplate = poweredBySource.slice(
  poweredBySource.indexOf("---", 3) + 3,
);

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_astro") continue;
      out.push(...htmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

describe("PoweredBy", () => {
  it("paints the mark from currentColor only", () => {
    const svg = poweredBySource.slice(poweredBySource.indexOf("<svg"));
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(svg).not.toMatch(/\brgba?\(/);
    expect(svg).toContain("currentColor");
  });

  it("inlines the mark instead of loading it as a document", () => {
    // An <img src> SVG is a separate document that page CSS cannot
    // reach, so currentColor would never resolve.
    expect(poweredByTemplate).not.toMatch(/<img\b/);
    expect(poweredByTemplate).toContain("<svg");
  });

  it("links out to the Grove site safely", () => {
    expect(poweredBySource).toContain('href = "https://grove.dev.mn"');
    expect(poweredBySource).toContain('rel="noopener noreferrer"');
  });

  it("is rendered by the footer behind the poweredBy flag", () => {
    expect(footerSource).toContain("PoweredBy");
    expect(footerSource).toContain(
      "poweredBy ?? site.footer?.poweredBy ?? true",
    );
  });
});

describe.skipIf(!existsSync(dist))("built output", () => {
  it("carries the attribution on every route", () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, "utf8");
      expect(html, file.replace(dist, "")).toContain("Powered by");
      expect(html, file.replace(dist, "")).toContain("https://grove.dev.mn");
    }
  });
});
