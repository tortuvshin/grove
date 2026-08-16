import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_NAMES = new Set(["node_modules", "dist", ".astro", ".DS_Store"]);
const GENERATED_PUBLIC_NAMES = new Set([
  "llms.txt",
  "llms-full.txt",
  "sitemap.xml",
  "robots.txt",
  "og-image.svg",
  "og",
]);
const GROVE_PACKAGES = ["@grove-dev/astro", "@grove-dev/cli", "@grove-dev/core"] as const;

export interface InitOptions {
  projectName?: string;
  version?: string;
}

export function readCliVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, "package.json"), resolve(here, "../package.json")]) {
    try {
      const pkg = JSON.parse(requireText(candidate)) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // Source and published layouts intentionally use different paths.
    }
  }
  return "0.0.0-dev";
}

function requireText(path: string): string {
  // Synchronous version lookup happens once while constructing the CLI.
  return globalThis.process.getBuiltinModule("node:fs").readFileSync(path, "utf8");
}

export function scaffoldSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "site"), resolve(here, "../../../apps/example")];
  const found = candidates.find((candidate) => existsSync(resolve(candidate, "package.json")));
  if (!found) throw new Error("Grove site scaffold is missing. Reinstall @grove-dev/cli.");
  return found;
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function packageName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "grove-directory";
}

async function ensureEmpty(targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  const entries = (await readdir(targetDir)).filter((entry) => !SKIP_NAMES.has(entry));
  if (entries.length > 0) {
    throw new Error(`${targetDir} is not empty. Choose a new directory.`);
  }
}

export async function initDirectory(
  targetDir: string,
  options: InitOptions = {},
): Promise<{ targetDir: string; projectName: string }> {
  const source = scaffoldSource();
  const target = resolve(targetDir);
  await ensureEmpty(target);
  await cp(source, target, {
    recursive: true,
    filter: (sourcePath) => {
      const pathFromRoot = relative(source, sourcePath);
      const parts = pathFromRoot.split(/[\\/]/);
      if (parts.some((part) => SKIP_NAMES.has(part))) return false;
      if (parts[0] === "data" && parts[1] === "generated") return false;
      if (parts[0] === "public" && GENERATED_PUBLIC_NAMES.has(parts[1] ?? "")) {
        return false;
      }
      return true;
    },
  });

  const version = options.version ?? readCliVersion();
  const fallbackName = target.split(/[\\/]/).at(-1) ?? "grove-directory";
  const rawName = options.projectName ?? fallbackName;
  const projectName = packageName(rawName);
  const packagePath = resolve(target, "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
    name?: string;
    dependencies?: Record<string, string>;
  };
  pkg.name = projectName;
  pkg.dependencies ??= {};
  for (const dependency of GROVE_PACKAGES) pkg.dependencies[dependency] = `^${version}`;
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  const configPath = resolve(target, "grove.config.ts");
  const config = await readFile(configPath, "utf8");
  await writeFile(
    configPath,
    config.replace(/name:\s*"[^"]+"/, `name: ${JSON.stringify(titleCase(rawName))}`),
    "utf8",
  );
  return { targetDir: target, projectName };
}
