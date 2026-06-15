/**
 * Grove test-layer — Step 6 integration smoke.
 *
 * Runs `grove new --yes --framework astro --deploy none --name
 * test-tmp --no-git --no-install` against a real tmpdir, asserts
 * the expected file set is created, and cleans up. The CLI is
 * invoked via `tsx packages/cli/src/index.ts` (the dev path)
 * so the test exercises the real `copyTemplate`,
 * `renameProjectInTemplate`, and the no-install fast path
 * together — the same code path a developer runs when they
 * `pnpm dev` the CLI in their editor.
 *
 * The integration project in `vitest.config.ts` runs this test
 * in a single-fork pool (maxWorkers: 1, isolate: false) so two
 * scaffolds never race for the same tmpdir.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MONOREPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CLI_ENTRY = resolve(MONOREPO_ROOT, "packages/cli/src/index.ts");

/**
 * Find a `tsx` executable on disk. The CLI's `tsx` devDep
 * installs a symlink at `packages/cli/node_modules/.bin/tsx`,
 * and the workspace root has one at `node_modules/.bin/tsx`.
 * Walk both and use whichever is found.
 */
function findTsxBin(): string {
  const candidates = [
    resolve(MONOREPO_ROOT, "node_modules/.bin/tsx"),
    resolve(MONOREPO_ROOT, "packages/cli/node_modules/.bin/tsx"),
  ];
  for (const c of candidates) {
    try {
      // statSync throws on ENOENT; we catch and move on.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { statSync } = require("node:fs") as typeof import("node:fs");
      statSync(c);
      return c;
    } catch {
      continue;
    }
  }
  throw new Error(
    "Could not find `tsx` executable. Run `pnpm install` at the monorepo root.",
  );
}
const TSX_BIN = findTsxBin();

/**
 * Run `grove new <projectName>` with the given flags from a
 * subshell chdir'd into `cwd`. Returns stdout/stderr and
 * exit code.
 *
 * Implementation note: the CLI's `grove new` does
 * `resolve(projectDir)` which expands the project name to
 * `<process.cwd()>/<name>`. Going through `pnpm exec tsx`
 * would chdir the spawned process into the monorepo
 * (`pnpm --dir monorepo` is implied), so we invoke tsx
 * directly and use the `cwd` option of execFile to set the
 * child's working directory. The brief's `tmpRoot` then
 * becomes the actual scaffold location, and the short
 * project name stays short (so `pkg.name` is
 * `test-tmp-astro-default`, not the slugified absolute path).
 */
async function runGroveNew(
  cwd: string,
  flags: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      TSX_BIN,
      [CLI_ENTRY, "new", ...flags],
      { cwd, env: { ...process.env, CI: "1" } },
    );
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: typeof e.code === "number" ? e.code : 1,
    };
  }
}

describe("grove new — integration smoke", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "grove-new-smoke-"));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it(
    "creates the expected file set in a tmpdir with --no-git --no-install",
    { timeout: 120_000 },
    async () => {
      const projectName = "test-tmp";
      // The CLI receives the project dir as a POSITIONAL arg
      // (the brief used `--name test-tmp` but the actual flag
      // shape is positional — see cli/src/index.ts:108-110).
      // The CLI does `resolve(projectDir)` so we pass a short
      // name; the scaffold lands at `<tmpRoot>/<projectName>`
      // because we set execFile's `cwd` to `tmpRoot`.
      const { code, stdout, stderr } = await runGroveNew(tmpRoot, [
        projectName,
        "--yes",
        "--framework", "astro",
        "--deploy", "none",
        "--no-git",
        "--no-install",
      ]);

      if (code !== 0) {
        throw new Error(
          `grove new exited ${code}.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
        );
      }

      // Scaffold landed at tmpRoot/<projectName>.
      const targetDir = join(tmpRoot, projectName);
      const targetStat = await stat(targetDir);
      expect(targetStat.isDirectory()).toBe(true);

      // High-signal file set. Pinning a few; the full
      // enumeration is the @grove-dev/cli unit tests' job.
      const expectedFiles = [
        "package.json",
        "astro.config.mjs",
        "grove.config.ts",
        "README.md",
        ".gitignore",
      ];
      for (const file of expectedFiles) {
        const filePath = join(targetDir, file);
        const s = await stat(filePath);
        expect(s.isFile()).toBe(true);
      }

      // The package.json was rewritten to a slug-form name
      // (the renameProjectInTemplate path).
      const pkg = JSON.parse(await readFile(join(targetDir, "package.json"), "utf8")) as { name: string };
      expect(pkg.name).toBe(`${projectName}-astro-default`);

      // grove.config.ts was written.
      const groveConfig = await readFile(join(targetDir, "grove.config.ts"), "utf8");
      expect(groveConfig).toContain("project-directory");

      // .github/workflows/validate-data.yml was written.
      const workflows = await readdir(join(targetDir, ".github", "workflows"));
      expect(workflows).toContain("validate-data.yml");
    },
  );

  it(
    "with --install would fail in a sandboxed env (skipped — we use --no-install)",
    { timeout: 60_000 },
    async () => {
      // The brief's "Run in a tmpdir under $TMPDIR" + "Not
      // require network access" constraints make a real
      // `pnpm install` impossible. We therefore invoke
      // `grove new` with --no-install and assert the file
      // set is complete. This test documents the decision.
      const projectName = "test-tmp-2";
      const { code, stdout, stderr } = await runGroveNew(tmpRoot, [
        projectName,
        "--yes",
        "--framework", "astro",
        "--deploy", "none",
        "--no-git",
        "--no-install",
      ]);
      expect(code).toBe(0);
      if (code !== 0) {
        throw new Error(`stderr: ${stderr}\nstdout: ${stdout}`);
      }
      const targetDir = join(tmpRoot, projectName);
      // data/ directory was created (the CLI's ensureDir loop
      // runs even with --no-install).
      const dataDir = await stat(join(targetDir, "data"));
      expect(dataDir.isDirectory()).toBe(true);
    },
  );
});
