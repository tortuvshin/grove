/**
 * Published-tarball guards.
 *
 * `files` in a manifest is a promise about what a consumer receives, and
 * nothing verifies it until someone installs the package. All four Grove
 * packages declare `"license": "MIT"` and shipped no LICENSE file at all —
 * the text existed only at the repository root, which npm does not include.
 *
 * These tests pack each package for real (`npm pack --dry-run`) and assert
 * the tarball against what the manifest claims.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const PUBLISHED = ["core", "astro", "cli", "starlight"] as const;

interface PackResult {
	entryCount: number;
	unpackedSize: number;
	files: { path: string }[];
}

/** Ask npm exactly what it would publish, without publishing. */
function pack(pkg: string): PackResult {
	const dir = resolve(repoRoot, `packages/${pkg}`);
	const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
		cwd: dir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	return (JSON.parse(raw) as PackResult[])[0]!;
}

const manifest = (pkg: string) =>
	JSON.parse(readFileSync(resolve(repoRoot, `packages/${pkg}/package.json`), "utf8")) as {
		name: string;
		license: string;
		types?: string;
		files: string[];
	};

describe.each(PUBLISHED)("@grove-dev/%s tarball", (pkg) => {
	const result = pack(pkg);
	const paths = result.files.map((f) => f.path);
	const meta = manifest(pkg);

	it("ships its README", () => {
		expect(paths).toContain("README.md");
	});

	it("ships the license text it claims", () => {
		expect(meta.license).toBe("MIT");
		// npm includes a root-level LICENSE automatically, but only if the
		// file is inside the package directory — the monorepo root does not
		// count, which is how four MIT packages shipped without one.
		expect(paths).toContain("LICENSE");
	});

	it("ships type declarations", () => {
		expect(paths.some((p) => p.endsWith(".d.ts"))).toBe(true);
	});

	it("ships no source maps or test files", () => {
		const noise = paths.filter((p) => /\.(test|spec)\.[jt]s$/.test(p));
		expect(noise, `test files in the tarball: ${noise.join(", ")}`).toEqual([]);
	});

	it("is not accidentally enormous", () => {
		// A guard against a stray directory landing in `files` — not a
		// performance budget. The CLI is the largest at ~300 KB because it
		// bundles the scaffold; core is ~1.4 MB because it vendors two Inter
		// font weights for the OG rasterizer.
		expect(result.unpackedSize).toBeLessThan(6 * 1024 * 1024);
	});
});

describe("third-party notices", () => {
	it("ships the Starlight attribution file it references", () => {
		const paths = pack("starlight").files.map((f) => f.path);
		expect(paths).toContain("THIRD_PARTY_LICENSES.md");
	});

	it("ships the vendored font license alongside the fonts", () => {
		const paths = pack("core").files.map((f) => f.path);
		const fonts = paths.filter((p) => /\.(ttf|otf|woff2?)$/.test(p));
		expect(fonts.length).toBeGreaterThan(0);
		expect(paths.some((p) => /assets\/fonts\/LICENSE/i.test(p))).toBe(true);
	});
});
