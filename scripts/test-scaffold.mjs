#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const parent = await mkdtemp(join(tmpdir(), "grove-scaffold-"));
const target = join(parent, "directory");
const packs = join(parent, "packs");

function run(command, args, cwd = root) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? done() : reject(new Error(`${command} exited ${code}`)));
  });
}

await run("pnpm", ["--filter", "@grove-dev/cli", "build"]);
await mkdir(packs);
for (const name of ["core", "astro", "cli"]) {
  await run("pnpm", ["--filter", `@grove-dev/${name}`, "pack", "--pack-destination", packs]);
}
await run(process.execPath, [resolve(root, "packages/cli/dist/index.js"), "init", target, "--no-install", "--no-git"]);

const packagePath = join(target, "package.json");
const pkg = JSON.parse(await readFile(packagePath, "utf8"));
const localPackages = {};
for (const name of ["core", "astro", "cli"]) {
  const manifest = JSON.parse(
    await readFile(resolve(root, "packages", name, "package.json"), "utf8"),
  );
  localPackages[`@grove-dev/${name}`] =
    `file:${join(packs, `grove-dev-${name}-${manifest.version}.tgz`)}`;
}
Object.assign(pkg.dependencies, localPackages);
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(
  join(target, "pnpm-workspace.yaml"),
  [
    "packages:",
    "  - .",
    "overrides:",
    ...Object.entries(localPackages).map(([name, value]) => `  '${name}': ${value}`),
    "",
  ].join("\n"),
);

await run("pnpm", ["install"], target);
await run("pnpm", ["exec", "grove", "check"], target);
await run("pnpm", ["build"], target);
console.log(`\nScaffold smoke passed: ${target}`);
