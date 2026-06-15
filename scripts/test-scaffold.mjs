#!/usr/bin/env node
/**
 * Local scaffold smoke test — runs the freshly built CLI against a scratch
 * directory to confirm that `grove new` produces an installable project.
 *
 * Why this exists:
 *   - npm publish → install cycle is too slow to iterate on.
 *   - The CLI is published standalone, so npm install on the scaffolded
 *     project verifies that no monorepo-only dependency protocol leaked
 *     into the generated package.
 *
 * What it does:
 *   1. Builds all workspace packages.
 *   2. For the Astro framework:
 *      a. Runs `node packages/cli/dist/index.js new <name> --framework astro --yes`
 *         from a scratch dir.
 *      b. Asserts the scaffolded package.json has no workspace-protocol deps.
 *      c. Asserts the scaffolded package.json pins a real version for
 *         @grove-dev/astro / @grove-dev/cli / @grove-dev/core.
 *      d. Asserts pnpm install completes without 404s.
 *   3. Reports pass/fail and exits non-zero on any failure.
 *
 * V1 scope: Astro only. The Next.js and SvelteKit adapters are skeleton
 * packages in V1 — they will be added back to this smoke test when
 * their templates ship real pages, components, and layouts in v0.3.0.
 *
 * Usage: pnpm test:scaffold
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(new URL("..", import.meta.url).pathname);
const FRAMEWORKS = ["astro"];

function run(bin, args, opts = {}) {
  const res = spawnSync(bin, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  if (res.status !== 0) {
    throw new Error(`${bin} ${args.join(" ")} exited with ${res.status}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(`scaffold check failed: ${message}`);
  }
}

function scaffold(name, framework) {
  // Run the CLI from a parent dir so `grove new <name>` creates a subdir.
  const parent = mkdtempSync(join(tmpdir(), "grove-scaffold-"));
  const cliPath = join(REPO_ROOT, "packages/cli/dist/index.js");
  // The CLI resolves framework templates from `process.cwd()` first (see
  // template-loader.templatesRoot), so we need node_modules/@grove-dev/<framework>
  // visible from the parent dir. We COPY the workspace's node_modules
  // recursively rather than symlinking it. The symlink shortcut is
  // tempting but it's the wrong thing to test: the scaffold test is
  // supposed to validate against real published versions, not the
  // repo's local symlinks (which would let a broken template ship
  // because the symlink hides it from the test's install path).
  // The copy is slower but it exercises the same install path a
  // real user hits, which is the point of the smoke test.
  // (Audit #12.)
  const sourceNm = join(REPO_ROOT, "node_modules");
  if (existsSync(sourceNm)) {
    cpSync(sourceNm, join(parent, "node_modules"), {
      recursive: true,
      // Don't follow symlinks: the workspace's node_modules contains
      // symlinks to local `packages/*` siblings (pnpm's default for
      // linkWorkspacePackages: true). Following them and copying the
      // TARGETS would balloon the copy to gigabytes of pnpm-store
      // data. The CLI only needs to RESOLVE the symlinks, not read
      // through them at copy time — and `dereference: false` preserves
      // the same path structure a fresh `pnpm install` would produce
      // for any consumer who depends on `@grove-dev/<framework>`.
      dereference: false,
    });
  }
  try {
    run("node", [cliPath, "new", name, "--framework", framework, "--yes"], {
      cwd: parent,
    });
    return { parent, project: join(parent, name) };
  } catch (err) {
    rmSync(parent, { recursive: true, force: true });
    throw err;
  }
}

function checkProject(project, framework) {
  const pkgPath = join(project, "package.json");
  expect(existsSync(pkgPath), `${pkgPath} should exist`);

  const pkg = readJson(pkgPath);
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };

  // 1. No workspace-protocol deps should remain.
  for (const [name, value] of Object.entries(allDeps)) {
    if (typeof value === "string" && value.startsWith("workspace:")) {
      throw new Error(
        `${pkgPath}: ${name} is still pinned to "${value}" — scaffold did not rewrite workspace deps`,
      );
    }
  }

  // 2. The framework's own adapter and the core package must be
  //    pinned to a real published version. Other @grove-dev/*
  //    deps (cli, ui) are optional depending on the template.
  for (const name of [`@grove-dev/${framework}`, "@grove-dev/core"]) {
    const value = allDeps[name];
    expect(value, `${pkgPath}: missing dep ${name}`);
    expect(
      /^\d/.test(value),
      `${pkgPath}: ${name} is "${value}" — should be a real published version (e.g. 0.1.3)`,
    );
  }

  // 3. Any @grove-dev/* dep that IS present (cli, ui, etc.) must
  //    also be pinned to a real published version, not "*".
  for (const [name, value] of Object.entries(allDeps)) {
    if (!name.startsWith("@grove-dev/")) continue;
    expect(
      /^\d/.test(value),
      `${pkgPath}: ${name} is "${value}" — should be pinned to a real published version`,
    );
  }

  // 4. pnpm install must complete.
  console.log(`[test:scaffold] running pnpm install in ${project}`);
  run("pnpm", ["install", "--prefer-offline"], { cwd: project, stdio: "inherit" });

  // 5. node_modules should have every @grove-dev/* dep the template
  //    declared, each with a real version.
  const groveDeps = Object.entries(allDeps)
    .filter(([n]) => n.startsWith("@grove-dev/"))
    .map(([n]) => n);
  expect(groveDeps.length > 0, `${pkgPath}: no @grove-dev/* deps at all`);
  for (const name of groveDeps) {
    const installed = join(project, "node_modules", name, "package.json");
    expect(existsSync(installed), `${installed} should be installed`);
    const instPkg = readJson(installed);
    expect(instPkg.version, `${installed} has no version field`);
  }
}

function main() {
  // `--help` / `-h` exits early with usage text. Lets `node
  // scripts/test-scaffold.mjs --help` confirm the script still
  // loads and parses without running the build + scaffold cycle.
  if (process.argv.slice(2).some((a) => a === "--help" || a === "-h")) {
    console.log(
      `test-scaffold — local smoke test for the freshly built CLI.

Usage:
  node scripts/test-scaffold.mjs [options]

Options:
  -h, --help   print this help and exit

What it does:
  1. Runs scripts/check-starlight-sidebar.mjs (slug integrity).
  2. Builds every @grove-dev/* workspace.
  3. For each framework in V1 (astro):
     a. Copies the workspace's node_modules into a temp dir
        (recursive, no symlink — see scaffold() for why).
     b. Runs \`node packages/cli/dist/index.js new <name> --framework
        <f> --yes\` from the temp dir.
     c. Asserts the scaffolded package.json has no workspace-protocol
        deps, pins a real version for @grove-dev/<framework> and
        @grove-dev/core, and every @grove-dev/* dep is installed.
     d. Runs \`pnpm install --prefer-offline\` and confirms every
        @grove-dev/* dep has a real version under node_modules.

Exits non-zero if any step fails.
`,
    );
    return;
  }

  console.log("[test:scaffold] checking Starlight sidebar slugs…");
  // Fast smoke test: every `slug:` in docs/astro.config.mjs must
  // resolve to an existing file. Runs in milliseconds and lists
  // every missing slug at once, before a full docs build.
  run("node", [join(REPO_ROOT, "scripts/check-starlight-sidebar.mjs")], {
    stdio: "inherit",
  });
  console.log("[test:scaffold] building @grove-dev/* packages…");
  // Build every @grove-dev/* workspace, including `docs`. The filter
  // is self-maintaining: any new @grove-dev/* package added under
  // packages/ is picked up automatically.
  run(
    "pnpm",
    [
      "--filter",
      "@grove-dev/*",
      "build",
    ],
    { stdio: "inherit" },
  );

  const cliDist = join(REPO_ROOT, "packages/cli/dist/index.js");
  expect(
    existsSync(cliDist),
    `CLI not built — ${cliDist} missing. Did the @grove-dev/* build run?`,
  );

  let failed = 0;
  for (const framework of FRAMEWORKS) {
    const projectName = `test-${framework}`;
    console.log(`\n[test:scaffold] ── ${framework} ──`);
    let ctx;
    try {
      ctx = scaffold(projectName, framework);
      checkProject(ctx.project, framework);
      console.log(`[test:scaffold] ✓ ${framework} scaffold OK`);
    } catch (err) {
      failed++;
      console.error(`[test:scaffold] ✗ ${framework}: ${err.message}`);
    } finally {
      if (ctx) {
        rmSync(ctx.parent, { recursive: true, force: true });
      }
    }
  }

  if (failed > 0) {
    console.error(`\n[test:scaffold] ${failed} framework(s) failed`);
    process.exit(1);
  }
  console.log("\n[test:scaffold] all frameworks pass (V1: astro only — nextjs/svelte land in v0.3.0)");
}

main();
