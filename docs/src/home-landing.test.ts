import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = resolve(import.meta.dirname);

describe("docs homepage landing page", () => {
  it("uses the componentized product landing page with the required sections", async () => {
    const indexMdx = await readFile(
      resolve(docsRoot, "content/docs/index.mdx"),
      "utf8",
    );
    const homeLanding = await readFile(
      resolve(docsRoot, "components/HomeLanding.astro"),
      "utf8",
    );

    expect(indexMdx).toContain("import HomeLanding from '../../components/HomeLanding.astro'");
    expect(indexMdx).toContain("<HomeLanding />");

    expect(homeLanding).toContain("The framework for community knowledge");
    expect(homeLanding).toContain("What Is Grove");
    expect(homeLanding).toContain("Get Started In Seconds");
    expect(homeLanding).toContain("Ecosystem");
    expect(homeLanding).toContain("Built on a foundation of production-grade open tooling");
    expect(homeLanding).toContain("Start building with Grove");
    expect(homeLanding).toContain("npx @grove-dev/cli@latest new my-space");
    expect(homeLanding).toContain("Project Directory");
    expect(homeLanding).toContain("Coming soon / Schema-ready");
  });
});
