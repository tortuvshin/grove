import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const cli = resolve(root, "packages/cli/dist/index.js");

function run(args: string[], cwd: string): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("exit", (code) => code === 0 ? done() : reject(new Error(stderr)));
  });
}

describe("grove init integration", () => {
  beforeAll(async () => {
    await new Promise<void>((done, reject) => {
      const child = spawn("pnpm", ["--filter", "@grove-dev/cli", "build"], {
        cwd: root,
        stdio: "pipe",
      });
      child.on("exit", (code) => code === 0 ? done() : reject(new Error(`build exited ${code}`)));
    });
  });

  it("copies the canonical site with consumer-owned pages and without generated data", async () => {
    const parent = await mkdtemp(join(tmpdir(), "grove-init-integration-"));
    await run(["init", "open-apps", "--no-install", "--no-git"], parent);
    const target = join(parent, "open-apps");
    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));

    expect(pkg.name).toBe("open-apps");
    expect(pkg.scripts).toMatchObject({ dev: "astro dev", build: "astro build", check: "astro check" });
    expect(await readdir(join(target, ".github/workflows"))).toEqual([
      "ci.yml", "cleanup.yml", "deploy.yml", "sync-contributors.yml", "sync-github.yml",
    ]);
    expect(await readFile(join(target, "src/pages/index.astro"), "utf8")).toContain(
      "getHomePageModel(siteConfig)",
    );
    await expect(readFile(join(target, "data/generated/records.json"), "utf8")).rejects.toThrow();
    expect(await readFile(join(target, "data/records/ollama.yml"), "utf8")).toContain("name: Ollama");
  });
});
