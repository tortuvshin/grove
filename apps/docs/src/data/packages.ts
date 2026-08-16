/**
 * The canonical package status table.
 *
 * Versions are **imported from the real manifests** rather than retyped, so
 * the landing badge, the roadmap table, and the docs can never drift from
 * what is actually published. `scripts/release.mjs` writes those manifests;
 * everything downstream reads this module.
 *
 * If a package is added to or removed from the workspace, this file is the
 * one place that has to change — `tests/integration/docs-truth.test.ts`
 * asserts that the list here matches `pnpm-workspace.yaml` exactly.
 */
import astroPkg from '../../../../packages/astro/package.json';
import cliPkg from '../../../../packages/cli/package.json';
import corePkg from '../../../../packages/core/package.json';
import starlightPkg from '../../../../packages/starlight/package.json';

export type Stability = 'Stable' | 'Experimental';

export interface PackageStatus {
	/** npm package name. */
	name: string;
	/** Version, read from the package's own manifest. */
	version: string;
	/** One line: what this package is responsible for. */
	responsibility: string;
	/** Whether the public surface is settled. */
	stability: Stability;
	/** Public entry points, as declared in `exports`. */
	entryPoints: string[];
}

export const PACKAGES: PackageStatus[] = [
	{
		name: corePkg.name,
		version: corePkg.version,
		responsibility:
			'Headless publishing and maintenance engine — config, schemas, validation, generation, synchronization, collections, SEO artifacts, health, decisions, importers.',
		stability: 'Stable',
		entryPoints: ['@grove-dev/core', '@grove-dev/core/directory'],
	},
	{
		name: astroPkg.name,
		version: astroPkg.version,
		responsibility:
			'The supported renderer — Astro integration, layouts, components, and server view-models.',
		stability: 'Stable',
		entryPoints: [
			'@grove-dev/astro',
			'@grove-dev/astro/server',
			'@grove-dev/astro/components/*.astro',
			'@grove-dev/astro/layouts/*.astro',
			'@grove-dev/astro/ui/*.astro',
			'@grove-dev/astro/styles.css',
		],
	},
	{
		name: cliPkg.name,
		version: cliPkg.version,
		responsibility:
			'Project creation and maintenance operations — init, check, sync, cleanup, import, collection promote, readme generate, icons sync, audit.',
		stability: 'Stable',
		entryPoints: ['grove (bin)', '@grove-dev/cli'],
	},
	{
		name: starlightPkg.name,
		version: starlightPkg.version,
		responsibility:
			'An optional Starlight theme plugin for documentation sites. Independent of the Grove publishing pipeline.',
		stability: 'Stable',
		entryPoints: [
			'@grove-dev/starlight',
			'@grove-dev/starlight/schema',
			'@grove-dev/starlight/components',
			'@grove-dev/starlight/styles/*',
		],
	},
];

/**
 * The version every published package is pinned to. The release script bumps
 * all four in lockstep, so any one of them is the release line — but assert
 * it rather than assume it, because a partially-applied bump is exactly the
 * failure this module exists to catch.
 */
export const GROVE_VERSION: string = (() => {
	const versions = new Set(PACKAGES.map((p) => p.version));
	if (versions.size !== 1) {
		throw new Error(
			`Published package versions disagree: ${PACKAGES.map((p) => `${p.name}@${p.version}`).join(', ')}`,
		);
	}
	return PACKAGES[0]!.version;
})();

/** `0.6.1` → `v0.6` — the release line shown on the landing badge. */
export const GROVE_RELEASE_LINE = `v${GROVE_VERSION.split('.').slice(0, 2).join('.')}`;

/**
 * Blueprint status, rendered from one source so the roadmap, the docs, and
 * the landing cannot disagree about what is polished and what is not.
 */
export interface BlueprintStatus {
	name: string;
	kind: string;
	schema: Stability;
	defaultUi: Stability;
	note: string;
}

export const BLUEPRINTS: BlueprintStatus[] = [
	{
		name: 'Project directory',
		kind: 'project',
		schema: 'Stable',
		defaultUi: 'Stable',
		note: 'The polished end-to-end default. Every shipped page template is tuned for it.',
	},
	{
		name: 'Resource hub',
		kind: 'resource',
		schema: 'Stable',
		defaultUi: 'Experimental',
		note: 'Schema validates and records generate; list and detail pages reuse the project-directory templates.',
	},
	{
		name: 'Ecosystem map',
		kind: 'entity',
		schema: 'Stable',
		defaultUi: 'Experimental',
		note: 'Schema validates and records generate; list and detail pages reuse the project-directory templates.',
	},
];
