#!/usr/bin/env node
/**
 * Release script for the Grove monorepo.
 *
 * One command: build, bump versions, publish, in dependency order.
 *
 * Usage:
 *   pnpm release                # patch bump (0.1.0 -> 0.1.1)
 *   pnpm release --minor        # minor bump (0.1.0 -> 0.2.0)
 *   pnpm release --major        # major bump (0.1.0 -> 1.0.0)
 *   pnpm release --bump=2.3.4   # explicit version
 *   pnpm release --dry-run      # build + bump + dry-run publish (no actual publish)
 *   pnpm release --skip-build   # skip build step
 *   pnpm release --skip-bump    # skip version bump
 *
 * Order (dependency graph): core -> ui -> {astro,nextjs,svelte} -> cli.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const RELEASE_KIND = args.kind ?? "patch";
const EXPLICIT_VERSION = args.bump;
const DRY_RUN = Boolean(args["dry-run"]);
const SKIP_BUILD = Boolean(args["skip-build"]);
const SKIP_BUMP = Boolean(args["skip-bump"]);

const PACKAGES = [
  { name: "@grove-dev/core", dir: "packages/core" },
  { name: "@grove-dev/ui", dir: "packages/ui" },
  { name: "@grove-dev/astro", dir: "packages/astro" },
  { name: "@grove-dev/nextjs", dir: "packages/nextjs" },
  { name: "@grove-dev/svelte", dir: "packages/svelte" },
  { name: "@grove-dev/cli", dir: "packages/cli" },
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--minor") out.kind = "minor";
    else if (a === "--major") out.kind = "major";
    else if (a === "--patch") out.kind = "patch";
    else if (a === "--dry-run") out["dry-run"] = true;
    else if (a === "--skip-build") out["skip-build"] = true;
    else if (a === "--skip-bump") out["skip-bump"] = true;
    else if (a.startsWith("--bump=")) out.bump = a.slice("--bump=".length);
  }
  return out;
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split(".").map((n) => parseInt(n, 10));
  if (kind === "major") return `${maj + 1}.0.0`;
  if (kind === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function logSection(title) {
  console.log(`\n\x1b[1m\x1b[36m━━━ ${title} ━━━\x1b[0m`);
}

function logOk(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function logErr(msg) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`);
}

async function readPkg(dir) {
  return JSON.parse(await readFile(resolve(ROOT, dir, "package.json"), "utf8"));
}
async function writePkg(dir, pkg) {
  await writeFile(
    resolve(ROOT, dir, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf8",
  );
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: ROOT,
      shell: process.platform === "win32",
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function bumpAll() {
  logSection("Bumping versions");
  for (const p of PACKAGES) {
    const pkg = await readPkg(p.dir);
    const before = pkg.version;
    const after = EXPLICIT_VERSION ?? bumpVersion(before, RELEASE_KIND);
    pkg.version = after;
    // Note: we deliberately leave `workspace:*` deps untouched.
    // Workspace symlinks stay intact, no `pnpm install` is needed,
    // and `pnpm publish` rewrites `workspace:*` to the real version
    // in the tarball at publish time.
    await writePkg(p.dir, pkg);
    logOk(`${p.name}: ${before} → ${after}`);
  }
}

async function buildAll() {
  logSection("Building all packages");
  await run("pnpm", ["-r", "build"]);
}

async function publishAll() {
  logSection(`Publishing (${DRY_RUN ? "dry-run" : "live"})`);
  for (const p of PACKAGES) {
    const args = ["--filter", p.name, "publish", "--no-git-checks", "--access", "public"];
    if (DRY_RUN) args.push("--dry-run");
    try {
      await run("pnpm", args);
      logOk(`Published ${p.name}`);
    } catch (err) {
      logErr(`Failed to publish ${p.name}: ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  console.log("Grove release script");
  console.log(`  kind:       ${RELEASE_KIND}${EXPLICIT_VERSION ? ` (explicit ${EXPLICIT_VERSION})` : ""}`);
  console.log(`  dry-run:    ${DRY_RUN}`);
  console.log(`  skip-build: ${SKIP_BUILD}`);
  console.log(`  skip-bump:  ${SKIP_BUMP}`);
  console.log(`  order:      ${PACKAGES.map((p) => p.name).join(" → ")}`);

  if (!SKIP_BUMP) await bumpAll();
  if (!SKIP_BUILD) await buildAll();
  await publishAll();

  logSection("Done");
  console.log(DRY_RUN ? "Dry-run complete — no actual publishes." : "All packages published.");
}

main().catch((err) => {
  logErr(err.message);
  process.exit(1);
});
