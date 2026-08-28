import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initDirectory } from "./init.js";

describe("grove init (registry bootstrapper)", () => {
  it("installs the @grove/default scaffold into src/", async () => {
    const parent = await mkdtemp(join(tmpdir(), "grove-init-"));
    const target = join(parent, "ai-stack");
    const result = await initDirectory(target, {
      projectName: "AI Stack",
      version: "9.8.7",
    });

    // Engine + registry deps pinned to the CLI version.
    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    expect(pkg.name).toBe("ai-stack");
    expect(pkg.dependencies["@grove-dev/core"]).toBe("^9.8.7");
    expect(pkg.dependencies["@grove-dev/astro"]).toBe("^9.8.7");
    expect(pkg.dependencies["@grove-dev/cli"]).toBe("^9.8.7");
    expect(pkg.dependencies["@grove-dev/registry"]).toBe("^9.8.7");

    // grove.config.ts carries the project name.
    expect(await readFile(join(target, "grove.config.ts"), "utf8")).toContain(
      'name: "AI Stack"',
    );

    // The scaffold landed in src/.
    expect(existsSync(join(target, "src/components/grove/project-card.astro"))).toBe(true);
    expect(existsSync(join(target, "src/layouts/base-layout.astro"))).toBe(true);
    expect(existsSync(join(target, "src/lib/classnames.ts"))).toBe(true);
    expect(existsSync(join(target, "src/styles/system.css"))).toBe(true);

    // Lockfile was written with the install-time hashes.
    const lockfile = JSON.parse(
      await readFile(join(target, ".grove/registry.lock.json"), "utf8"),
    );
    expect(lockfile.scaffold).toBe("@grove/default");
    expect(lockfile.fileCount).toBeGreaterThan(0);

    // Return value surfaces the install report.
    expect(result.installedScaffold.manifest.name).toBe("@grove/default");
  });

  it("refuses to install into a non-empty target", async () => {
    const parent = await mkdtemp(join(tmpdir(), "grove-init-"));
    const target = join(parent, "dirty");
    // Pre-create an arbitrary file the policy should reject on.
    const { writeFile: wf, mkdir: md } = await import("node:fs/promises");
    await md(target, { recursive: true });
    await wf(join(target, "README.md"), "occupied");
    await expect(initDirectory(target, { projectName: "x" })).rejects.toThrow(
      /not empty/,
    );
  });
});
