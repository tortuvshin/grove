/**
 * Vitest root config for the Grove monorepo.
 *
 * Single source of truth for "how to run tests in this repo":
 *
 *   pnpm test              # run everything (root)
 *   pnpm test:watch        # interactive watch mode
 *   pnpm test:coverage     # v8 coverage report
 *   pnpm --filter @grove-dev/core test   # one package only
 *
 * Vitest 4 `projects` array (replaces the V3 `defineWorkspace` API).
 * Each project is either an inline config or a glob of package
 * folders that each carry their own `vitest.config.ts`. Per-package
 * test scripts (e.g. `pnpm --filter @grove-dev/core test`) invoke
 * Vitest with `--dir src` from inside the package, so they don't
 * need to know about this root config.
 *
 * Why projects (and not a single config):
 *   - The Starlight package mixes `.ts` + `.astro` + style assets at
 *     the package root (no `src/`), so its test directory is
 *     `tests/`, not `src/`. Inline project config handles that.
 *   - The integration smoke (Step 6) lives in `tests/integration/`
 *     and needs a longer timeout and a single-fork pool; giving it
 *     its own project keeps that off the fast unit suite.
 *
 * The `coverage` block is intentionally at the root — coverage is
 * computed for the whole process, not per-project. Only the unit
 * projects are scanned (the integration scope is too slow to be in
 * the default coverage run).
 */
import { defineConfig } from "vitest/config";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TMPDIR = resolve("./.tmp-test");
mkdirSync(TMPDIR, { recursive: true });

export default defineConfig({
  test: {
    globals: true,
    projects: [
      // ── Default unit scope: every package's `src/` directory ──
      {
        extends: true,
        test: {
          // `name` makes the project show up in the vitest
          // run list (`pnpm test --project unit`) and groups
          // its output under a single banner.
          name: "unit",
          // Each package's `src/` is the unit-test home. The
          // brief calls for "include the packages/* directories";
          // the `{test,spec}.ts` suffix keeps `.d.ts` and the
          // test files co-located in the same directory.
          include: ["packages/*/src/**/*.{test,spec}.ts"],
          // Several core tests use process.chdir() into a tmpdir;
          // parallel test files would race on the global CWD.
          // Serialize per-package runs (each package is still its
          // own project so they fan out).
          fileParallelism: false,
        },
      },
      // ── Starlight: tests live in `packages/starlight/tests/` ──
      {
        extends: true,
        test: {
          name: "starlight",
          root: "./packages/starlight",
          include: ["tests/**/*.{test,spec}.ts"],
        },
      },
      // ── Integration smoke ──
      {
        extends: true,
        test: {
          name: "integration",
          root: "./tests/integration",
          include: ["**/*.{test,spec}.ts"],
          // Integration tests are slow; give them room.
          testTimeout: 60_000,
          hookTimeout: 60_000,
          // One worker + no isolate so the `grove new` subprocess
          // never races another scaffold for the same tmpdir.
          // `isolate: false` is the Vitest 4 spelling for what was
          // `poolOptions.forks.singleFork: true` in Vitest 3.
          pool: "forks",
          maxWorkers: 1,
          isolate: false,
          // Vitest 4 requires distinct sequence.groupOrder for
          // projects that have different maxWorkers, so the
          // run scheduling can keep them apart.
          sequence: { groupOrder: 1 },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**", "packages/starlight/core/**", "packages/starlight/index.ts", "packages/starlight/schema.ts", "packages/starlight/user-components.ts"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/index.ts", "**/coverage/**"],
    },
    // Sandbox TMPDIR so tests that create real temp files
    // (`os.tmpdir()` + chdir) don't collide with the
    // `.opencode/tmp/` shim set by the opencode runtime. The
    // per-test `tmpdir({prefix})` paths then live under
    // `./.tmp-test/` instead of `./.opencode/tmp/`, where the
    // vitest/vite SSR loader wouldn't be looking for stale
    // module-resolution temp files from a previous run.
    env: {
      TMPDIR: TMPDIR + "/",
    },
  },
});
