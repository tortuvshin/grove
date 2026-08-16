/**
 * Shipping-truth guards.
 *
 * Grove's public surface — README, landing, roadmap, changelog, package
 * metadata — drifted a full minor release behind the code once already:
 * the roadmap described `0.5.0-next.2` and three packages that were never
 * published while the manifests sat at `0.6.1`. Prose does not fail a
 * build, so nothing caught it.
 *
 * These tests make the contradictions fail. Each one encodes a claim the
 * repository makes about itself and checks it against the code.
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), "utf8");
const manifest = (name: string) =>
	JSON.parse(read(`packages/${name}/package.json`)) as {
		name: string;
		version: string;
		private?: boolean;
	};

/** The four packages that are actually published to npm. */
const PUBLISHED = ["core", "astro", "cli", "starlight"] as const;

/**
 * Files that are allowed to talk about old versions and removed packages,
 * because their whole job is to record what used to be true.
 */
const HISTORICAL = [
	"CHANGELOG.md",
	"changelogs/",
	"apps/docs/vision.md",
	"apps/docs/MILESTONES.md",
	"apps/docs/src/content/docs/reference/migration.md",
];

/**
 * Walk the tracked source tree. Build output, dependencies, scratch, and
 * test temp dirs are not product surface and are excluded wholesale.
 */
const SKIP_DIRS = new Set([
	".git",
	".astro",
	".audit",
	".grove",
	".tmp-test",
	"coverage",
	"dist",
	"node_modules",
]);

const TEXT_EXT = /\.(md|mdx|ts|tsx|js|mjs|cjs|astro|json|yml|yaml|css|txt)$/;

function walk(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		let stat: ReturnType<typeof statSync>;
		try {
			// statSync follows symlinks; a dangling one throws. Skipping is
			// right here — a broken link has no text to scan — and the
			// `no dangling symlinks` test below is what reports it.
			stat = statSync(full);
		} catch {
			continue;
		}
		if (stat.isDirectory()) walk(full, acc);
		else if (TEXT_EXT.test(entry)) acc.push(full);
	}
	return acc;
}

/** Every symlink in the tracked tree, repo-relative, with its target. */
function symlinks(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (lstatSync(full).isSymbolicLink()) acc.push(full);
		else {
			try {
				if (statSync(full).isDirectory()) symlinks(full, acc);
			} catch {
				/* unreachable: lstat said it is not a link */
			}
		}
	}
	return acc;
}

/** This file states every banned string in order to ban it. */
const SELF = "tests/integration/docs-truth.test.ts";

/** Every text file in the repo, repo-relative, excluding historical records. */
function currentSurface(): string[] {
	return walk(repoRoot)
		.map((f) => f.slice(repoRoot.length + 1))
		.filter((f) => f !== SELF && !HISTORICAL.some((h) => f === h || f.startsWith(h)));
}

/**
 * Naming a dead thing in order to say it is dead is not drift — the roadmap
 * has to tell readers that `@grove-dev/ui` was never published. Flag a match
 * only when its line does not also disclaim it.
 */
const DISCLAIMED =
	/do(es)? \*?\*?not\*?\*? exist|never (been )?published|no longer resolves|was replaced by|retired|historical|deleted from the workspace/i;

/**
 * `file:line` for every line matching `pattern` without a disclaimer.
 *
 * The disclaimer is looked for across a three-line window, not the matched
 * line alone: docs prose is hard-wrapped, so "`@grove-dev/ui` … do **not**"
 * and "exist in the workspace" routinely land on separate lines.
 */
function offenders(pattern: RegExp): string[] {
	const hits: string[] = [];
	for (const file of currentSurface()) {
		const lines = read(file).split("\n");
		lines.forEach((line, i) => {
			if (!pattern.test(line)) return;
			const window = lines.slice(i, i + 3).join(" ");
			if (!DISCLAIMED.test(window)) hits.push(`${file}:${i + 1}`);
		});
	}
	return hits;
}

describe("package surface", () => {
	it("publishes exactly the four packages the workspace declares", () => {
		const workspace = read("pnpm-workspace.yaml");
		const declared = [...workspace.matchAll(/^\s+- packages\/(\S+)/gm)].map((m) => m[1]);
		expect(declared.sort()).toEqual([...PUBLISHED].sort());
	});

	it("pins every published package to the same version", () => {
		const versions = PUBLISHED.map((p) => [p, manifest(p).version] as const);
		const distinct = new Set(versions.map(([, v]) => v));
		expect(
			distinct.size,
			`versions disagree: ${versions.map(([p, v]) => `${p}@${v}`).join(", ")}`,
		).toBe(1);
	});

	it("keeps the docs package status table in sync with the manifests", () => {
		const table = read("apps/docs/src/data/packages.ts");
		for (const pkg of PUBLISHED) {
			const { name } = manifest(pkg);
			expect(table, `${name} missing from PACKAGES`).toContain(`packages/${pkg}/package.json`);
		}
		// Versions must be imported, never retyped — a literal version
		// string here is exactly the drift this module exists to prevent.
		expect(table).not.toMatch(/version:\s*['"]\d+\.\d+\.\d+/);
	});
});

describe("release truth", () => {
	const current = manifest("core").version;

	it("documents the current version in the changelog", () => {
		expect(read("CHANGELOG.md")).toContain(`## [${current}]`);
	});

	it("links the current version at the bottom of the changelog", () => {
		expect(read("CHANGELOG.md")).toContain(`[${current}]: https://github.com/`);
	});

	it("states the current version on the roadmap", () => {
		const roadmap = read("apps/docs/src/content/docs/roadmap.md");
		expect(roadmap).toContain(current);
		expect(roadmap).toMatch(new RegExp(`Shipped — \`${current.replace(/\./g, "\\.")}\``));
	});

	it("reads the landing badge from package data instead of a literal", () => {
		const hero = read("apps/docs/src/components/home/Hero.astro");
		expect(hero).toContain("GROVE_RELEASE_LINE");
		expect(hero, "hero hardcodes a release line").not.toMatch(/Grove v\d+\.\d+/);
	});
});

describe("no stale claims in current documentation", () => {
	it("never describes a 0.5.0 pre-release as current", () => {
		expect(offenders(/0\.5\.0-next/)).toEqual([]);
	});

	it("never references packages that do not exist", () => {
		expect(offenders(/@grove-dev\/(ui|nextjs|svelte)\b/)).toEqual([]);
	});

	it("ships no dangling symlinks", () => {
		// `apps/docs/LICENSE` pointed at `../LICENSE` (i.e. `apps/LICENSE`,
		// which does not exist) for three releases. A package that appears
		// to carry a license but resolves to nothing is worse than one that
		// carries none.
		const broken = symlinks(repoRoot)
			.filter((f) => !existsSync(f))
			.map((f) => f.slice(repoRoot.length + 1));
		expect(broken).toEqual([]);
	});

	it("never links a retired domain", () => {
		// The retired domains: `open-apps` + `.dev.mn` no longer resolves at
		// all, and the old grove `.dev.mn` host was replaced by withgrove.dev.
		// Either one in current copy is a dead link. Split so this file does
		// not trip its own guard.
		expect(offenders(/open-apps\.dev\.mn|grove\.dev\.mn/)).toEqual([]);
	});
});
