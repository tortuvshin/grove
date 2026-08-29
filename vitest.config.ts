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

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const TMPDIR = resolve('./.tmp-test');
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
          name: 'unit',
          // Each package's `src/` is the unit-test home. The
          // brief calls for "include the packages/* directories";
          // the `{test,spec}.ts` suffix keeps `.d.ts` and the
          // test files co-located in the same directory.
          include: [
            'packages/*/src/**/*.{test,spec}.ts',
            'apps/docs/src/**/*.{test,spec}.ts',
            // The registry scaffold's source lives at
            // packages/registry/default/ (not */src/, since `default`
            // is itself what `grove init` installs) — its own tests
            // (classnames.test.ts etc.) need an explicit include.
            'packages/registry/default/**/*.{test,spec}.ts',
          ],
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
          name: 'starlight',
          root: './packages/starlight',
          include: ['tests/**/*.{test,spec}.ts'],
        },
      },
      // ── Integration smoke ──
      {
        extends: true,
        test: {
          name: 'integration',
          root: './tests/integration',
          include: ['**/*.{test,spec}.ts'],
          // `grove-audit.test.ts` has its own project below. Without
          // this exclude it matched BOTH, so `pnpm test` ran it twice
          // concurrently — two `astro preview` servers racing for port
          // 4321, and two Lighthouse runs competing for CPU. The audit
          // asserts a perfect 100 with a 0.05 CLS budget, so the pair
          // starved each other and one failed at random. Deterministic
          // failure, non-deterministic victim.
          exclude: ['**/grove-audit.test.ts'],
          // Integration tests are slow; give them room.
          testTimeout: 60_000,
          hookTimeout: 60_000,
          // One worker + no isolate so the `grove init` subprocess
          // never races another scaffold for the same tmpdir.
          // `isolate: false` is the Vitest 4 spelling for what was
          // `poolOptions.forks.singleFork: true` in Vitest 3.
          pool: 'forks',
          maxWorkers: 1,
          isolate: false,
          // Vitest 4 requires distinct sequence.groupOrder for
          // projects that have different maxWorkers, so the
          // run scheduling can keep them apart.
          sequence: { groupOrder: 1 },
        },
      },
      // ── End-to-end grove audit (boots apps/example preview + runs grove audit) ──
      {
        extends: true,
        test: {
          name: 'integration-audit',
          include: ['tests/integration/grove-audit.test.ts'],
          timeout: 600_000,
          fileParallelism: false,
          // Lighthouse asserts a perfect 100 with a 0.05 CLS budget,
          // which only holds on an unloaded machine. Run this project
          // after the others — the `grove init` smoke above spawns an
          // install and a full site build, and sharing a CPU with it
          // pushes the browse page over the budget. The shift it then
          // reports is real but pre-existing; contention just makes it
          // visible, so co-scheduling turns a perf gate into a coin flip.
          sequence: { groupOrder: 2 },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'packages/*/src/**',
        'packages/starlight/core/**',
        'packages/starlight/index.ts',
        'packages/starlight/schema.ts',
        'packages/starlight/user-components.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/index.ts',
        '**/coverage/**',
      ],
      // Thresholds measured against the v0.5.0 unit-test baseline
      // (statements 60.07, branches 44.38, functions 56.95, lines 62.89).
      // Set just below baseline so the gate catches real regressions
      // without failing on organic noise. Files with 0% coverage
      // (e.g. prepare.ts, parseReadme.ts) are covered only by the
      // integration suite, which is intentionally not in this run.
      thresholds: {
        statements: 58,
        branches: 42,
        functions: 54,
        lines: 60,
      },
    },
    // Sandbox TMPDIR so tests that create real temp files
    // (`os.tmpdir()` + chdir) don't collide with the
    // `.opencode/tmp/` shim set by the opencode runtime. The
    // per-test `tmpdir({prefix})` paths then live under
    // `./.tmp-test/` instead of `./.opencode/tmp/`, where the
    // vitest/vite SSR loader wouldn't be looking for stale
    // module-resolution temp files from a previous run.
    env: {
      TMPDIR: TMPDIR + '/',
    },
  },
});
