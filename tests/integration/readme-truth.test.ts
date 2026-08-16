/**
 * README truth guards.
 *
 * A README is the npm landing page: for most readers it is the only Grove
 * documentation they will ever see, and nothing about it is compiled. The
 * Core README advertised `sortRecords` and `paginateRecords` for two
 * releases — names that belonged to `@grove-dev/ui`, a package that was
 * deleted from the workspace and never published.
 *
 * These tests check the claims that are cheap to verify mechanically:
 * every documented import resolves, every command exists, and no README
 * names a dead domain or a stale version.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");

const PUBLISHED = ["core", "astro", "cli", "starlight"] as const;
const READMES = [
	"README.md",
	...PUBLISHED.map((p) => `packages/${p}/README.md`),
] as const;

/** Every fenced code block of the given languages, with its README and index. */
function fences(file: string, langs: string[]): { lang: string; code: string; id: string }[] {
	const out: { lang: string; code: string; id: string }[] = [];
	const re = /^```(\w+)\n([\s\S]*?)^```/gm;
	let m: RegExpExecArray | null;
	let i = 0;
	while ((m = re.exec(read(file))) !== null) {
		i += 1;
		if (langs.includes(m[1]!)) out.push({ lang: m[1]!, code: m[2]!, id: `${file}#${i}` });
	}
	return out;
}

/** Named imports per module specifier across every `import {...} from '...'`. */
function namedImports(code: string): Map<string, string[]> {
	const found = new Map<string, string[]>();
	const re = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(code)) !== null) {
		const names = m[1]!
			.split(",")
			.map((n) => n.trim().split(/\s+as\s+/)[0]!.trim())
			.filter(Boolean);
		found.set(m[2]!, [...(found.get(m[2]!) ?? []), ...names]);
	}
	return found;
}

describe("every README exists and ships", () => {
	it.each(READMES)("%s is present and substantial", (file) => {
		expect(existsSync(resolve(repoRoot, file))).toBe(true);
		// A one-paragraph stub is how the Astro README shipped for three
		// releases; length is a crude but effective floor.
		expect(read(file).split("\n").length).toBeGreaterThan(40);
	});

	it.each(PUBLISHED)("@grove-dev/%s lists README.md in its package files", (pkg) => {
		const manifest = JSON.parse(read(`packages/${pkg}/package.json`)) as { files?: string[] };
		expect(manifest.files).toContain("README.md");
	});
});

describe("documented imports resolve", () => {
	const specifierToDist: Record<string, string> = {
		"@grove-dev/core": "packages/core/dist/index.js",
		"@grove-dev/core/directory": "packages/core/dist/directory-client.js",
	};

	it("only names symbols the package actually exports", async () => {
		const missing: string[] = [];

		for (const file of READMES) {
			for (const { code, id } of fences(file, ["ts", "typescript", "js"])) {
				for (const [specifier, names] of namedImports(code)) {
					const dist = specifierToDist[specifier];
					if (!dist) continue; // astro/starlight surfaces are checked separately
					const mod = await import(resolve(repoRoot, dist));
					for (const name of names) {
						if (!(name in mod)) missing.push(`${id}: ${specifier} has no export "${name}"`);
					}
				}
			}
		}

		expect(missing).toEqual([]);
	});
});

describe("documented commands exist", () => {
	const help = execFileSync(
		process.execPath,
		[resolve(repoRoot, "packages/cli/dist/index.js"), "--help"],
		{ encoding: "utf8" },
	);

	/**
	 * Top-level command names the binary actually registers.
	 *
	 * Commander indents each command by exactly two spaces and wraps long
	 * descriptions onto deeply-indented continuation lines — so anchoring on
	 * the two-space indent is what separates `icons` from the word `official`
	 * in a wrapped sentence.
	 */
	const registered = new Set(
		help
			.split("Commands:")[1]!
			.split("\n")
			.map((l) => /^ {2}([a-z][a-z-]*)/.exec(l)?.[1])
			.filter((c): c is string => Boolean(c) && c !== "help"),
	);

	it("registers the commands the CLI README documents", () => {
		const documented = new Set(
			[...read("packages/cli/README.md").matchAll(/^\s*(?:grove|pnpm exec grove) ([a-z-]+)/gm)].map(
				(m) => m[1]!,
			),
		);
		expect(documented.size).toBeGreaterThan(0);
		const unknown = [...documented].filter((c) => !registered.has(c));
		expect(unknown, `documented but not registered: ${unknown.join(", ")}`).toEqual([]);
	});

	it("documents every command the CLI registers", () => {
		const readme = read("packages/cli/README.md");
		const undocumented = [...registered].filter((c) => !readme.includes(`grove ${c}`));
		expect(undocumented, `registered but undocumented: ${undocumented.join(", ")}`).toEqual([]);
	});
});

describe("the Astro README's component table matches the package", () => {
	const readme = read("packages/astro/README.md");
	const dirNames = (sub: string) =>
		readdirSync(resolve(repoRoot, `packages/astro/src/${sub}`))
			.filter((f) => f.endsWith(".astro"))
			.map((f) => f.replace(/\.astro$/, ""));

	it.each([
		["components", "components"],
		["layouts", "layouts"],
		["ui", "ui"],
	])("documents every shipped %s", (_label, sub) => {
		const undocumented = dirNames(sub).filter((n) => !new RegExp(`\`${n}\``).test(readme));
		expect(undocumented, `missing from the table: ${undocumented.join(", ")}`).toEqual([]);
	});

	it("states the real counts", () => {
		const counts = `${dirNames("components").length} components, ${dirNames("layouts").length} layouts, ${dirNames("ui").length} UI primitives`;
		expect(readme).toContain(counts);
	});
});

describe("no stale claims in any README", () => {
	it.each(READMES)("%s names no retired domain", (file) => {
		expect(read(file)).not.toMatch(/open-apps\.dev\.mn|grove\.dev\.mn/);
	});

	it.each(READMES)("%s names no removed package", (file) => {
		expect(read(file)).not.toMatch(/@grove-dev\/(ui|nextjs|svelte)\b/);
	});

	it.each(READMES)("%s pins no version that will immediately drift", (file) => {
		// `@latest` and unversioned installs are fine; a hardcoded x.y.z in an
		// install command is stale the moment the next release lands.
		expect(read(file)).not.toMatch(/(?:pnpm add|npm i(?:nstall)?|yarn add)\s+@grove-dev\/\S+@\d/);
	});

	it.each(READMES)("%s resolves its repo-relative links", (file) => {
		const dir = resolve(repoRoot, file, "..");
		const broken = [...read(file).matchAll(/\]\((\.[^)#]*)/g)]
			.map((m) => m[1]!)
			.filter((target) => !existsSync(resolve(dir, target)));
		expect(broken).toEqual([]);
	});
});
