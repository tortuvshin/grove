import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "apps/example");
const target = resolve(root, "packages/cli/dist/site");
const skipped = new Set(["node_modules", "dist", ".astro", ".DS_Store"]);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, {
  recursive: true,
  filter(path) {
    const parts = relative(source, path).split(/[\\/]/);
    if (parts.some((part) => skipped.has(part))) return false;
    return !(parts[0] === "data" && parts[1] === "generated");
  },
});

const packagePath = resolve(target, "package.json");
const pkg = JSON.parse(await readFile(packagePath, "utf8"));
for (const name of ["@grove-dev/core", "@grove-dev/astro", "@grove-dev/cli"]) {
  const packageManifest = JSON.parse(
    await readFile(resolve(root, "packages", basename(name), "package.json"), "utf8"),
  );
  pkg.dependencies[name] = `^${packageManifest.version}`;
}
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
