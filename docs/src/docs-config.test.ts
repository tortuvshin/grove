import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("docs Astro config", () => {
  it("uses the local Starlight plugin and existing stylesheet", async () => {
    const config = await readFile(resolve(repoRoot, "docs/astro.config.mjs"), "utf8");

    expect(config).toContain("import lucode from '@grove-dev/starlight'");
    expect(config).toContain("customCss: ['./src/styles/global.css']");
    expect(config).toContain("lucode({");
    expect(config).not.toContain("starlightLinksValidator(");
    expect(config).not.toContain("starlightOpenInGH(");
    expect(config).not.toContain("starlightAi(");
    expect(config).not.toContain("./src/styles/custom.css");
  });
});
