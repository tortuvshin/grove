import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { initDirectory } from './init.js';
import { loadItem, REGISTRY_URL_TEMPLATE, writeItemFiles } from './registry.js';

/**
 * Stand-in for `shadcn add`: writes the item's files verbatim, no
 * network, no package-manager run. The real installer is exercised by
 * tests/integration/grove-init.test.ts.
 */
const installScaffold = async ({ target, itemPath }: { target: string; itemPath: string }) => {
  await writeItemFiles(await loadItem(itemPath), target);
};

/** Pinned so the assertions do not depend on the developer's own setup. */
const pnpm = { name: 'pnpm', version: '10.12.1' } as const;

describe('grove init (registry scaffold)', () => {
  it('scaffolds a project around the @grove/default item', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'ai-stack');
    const result = await initDirectory(target, {
      projectName: 'AI Stack',
      version: '9.8.7',
      installScaffold,
      packageManager: pnpm,
    });

    // package.json: Grove packages pinned to the CLI version, fixed scripts.
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('ai-stack');
    expect(pkg.type).toBe('module');
    for (const dep of ['core', 'astro', 'cli']) {
      expect(pkg.dependencies[`@grove-dev/${dep}`]).toBe('^9.8.7');
    }
    // The registry is a workspace build unit, never a consumer dependency.
    expect(pkg.dependencies['@grove-dev/registry']).toBeUndefined();
    expect(pkg.scripts).toEqual({ dev: 'astro dev', build: 'astro build', check: 'astro check' });
    // The one signal shadcn can read in an otherwise empty directory.
    expect(pkg.packageManager).toBe('pnpm@10.12.1');

    // components.json registers the @grove registry for later `shadcn add`s.
    const components = JSON.parse(await readFile(join(target, 'components.json'), 'utf8'));
    expect(components.registries['@grove']).toBe(REGISTRY_URL_TEMPLATE);
    expect(components.tailwind.css).toBe('src/styles/system.css');

    // tsconfig.json — Bundler resolution + the aliases the scaffold and shadcn need.
    const tsconfig = JSON.parse(await readFile(join(target, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.moduleResolution).toBe('Bundler');
    expect(tsconfig.compilerOptions.paths['@grove/generated/*']).toEqual(['data/generated/*']);
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);

    // grove.config.ts carries the project name.
    expect(await readFile(join(target, 'grove.config.ts'), 'utf8')).toContain('name: "AI Stack"');

    // astro.config.mjs registers the Tailwind v4 Vite plugin and the Grove integration.
    const astroConfig = await readFile(join(target, 'astro.config.mjs'), 'utf8');
    expect(astroConfig).toContain('@tailwindcss/vite');
    expect(astroConfig).toContain('@grove-dev/astro');

    // The scaffold landed in src/ — pages included, not just components.
    for (const file of [
      'src/pages/index.astro',
      'src/pages/[slug]/[recordSlug].astro',
      'src/components/grove/project-card.astro',
      'src/styles/system.css',
      'data/records/.gitkeep',
    ]) {
      expect(existsSync(join(target, file)), file).toBe(true);
    }

    // Lockfile records the install-time hashes with project-relative targets.
    const lockfile = JSON.parse(await readFile(join(target, '.grove/registry.lock.json'), 'utf8'));
    expect(lockfile.scaffold).toBe('@grove/default');
    expect(lockfile.fileCount).toBe(70);
    expect(lockfile.files).toHaveLength(70);
    for (const file of lockfile.files) {
      expect(file.target.startsWith('src/'), file.target).toBe(true);
      expect(file.hash.startsWith('sha256-'), file.target).toBe(true);
    }

    // pnpm-workspace.yaml pre-approves the dependency build scripts.
    // Without this, pnpm 11 fails every install in the project with
    // ERR_PNPM_IGNORED_BUILDS and shadcn never writes a file.
    const workspace = parseYaml(await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8'));
    expect(workspace.allowBuilds.esbuild).toBe(true); // pnpm 11's spelling
    expect(workspace.onlyBuiltDependencies).toContain('esbuild'); // pnpm 10's

    // Return value surfaces what was installed.
    expect(result.installedScaffold.name).toBe('default');
    expect(result.installedScaffold.files).toHaveLength(70);
  });

  it('installs the bundled item itself when shadcn fails', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'shadcn-down');
    const result = await initDirectory(target, {
      projectName: 'Shadcn Down',
      version: '9.8.7',
      installScaffold: () => Promise.reject(new Error('pnpm exited with 1')),
      packageManager: pnpm,
    });

    // Every scaffold file still lands…
    expect(result.installedScaffold.files).toHaveLength(70);
    for (const file of ['src/pages/index.astro', 'src/styles/system.css']) {
      expect(existsSync(join(target, file)), file).toBe(true);
    }

    // …and so do the npm dependencies shadcn would have installed, at
    // the item's own ranges. `@astrojs/check` proves the scoped-name
    // split: the range starts at the LAST `@`, not the first.
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.dependencies.astro).toBe('^7.1.3');
    expect(pkg.dependencies.tailwindcss).toBe('^4.3.3');
    expect(pkg.dependencies['@tailwindcss/vite']).toBe('^4.3.0');
    expect(pkg.dependencies['@astrojs/check']).toBe('^0.9.9');
    expect(pkg.dependencies['@grove-dev/core']).toBe('^9.8.7');

    // The lockfile is written on this path too, so `grove update` works.
    const lockfile = JSON.parse(await readFile(join(target, '.grove/registry.lock.json'), 'utf8'));
    expect(lockfile.fileCount).toBe(70);
  });

  it('rolls back a failed init so the retry is just `grove init`', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'retry');
    await expect(
      initDirectory(target, {
        projectName: 'Retry',
        installScaffold,
        packageManager: pnpm,
        itemPath: join(parent, 'no-such-item.json'),
      }),
    ).rejects.toThrow();

    // Nothing written by steps 2-3 survives — including the files
    // `ensureEmpty` would otherwise refuse to install over.
    expect(await readdir(target)).toEqual([]);

    // So the obvious retry works, with no manual cleanup in between.
    const result = await initDirectory(target, {
      projectName: 'Retry',
      installScaffold,
      packageManager: pnpm,
    });
    expect(result.installedScaffold.files).toHaveLength(70);
    expect(existsSync(join(target, 'src/pages/index.astro'))).toBe(true);
  });

  it('scaffolds for the package manager the user actually has', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'bun-space');
    const result = await initDirectory(target, {
      projectName: 'Bun Space',
      installScaffold,
      packageManager: { name: 'bun', version: '1.2.21' },
    });

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.packageManager).toBe('bun@1.2.21');
    // pnpm-workspace.yaml approves build scripts only pnpm asks about;
    // in a bun project it would be dead config.
    expect(existsSync(join(target, 'pnpm-workspace.yaml'))).toBe(false);
    // Everything else is identical — the scaffold itself is not
    // package-manager-specific.
    expect(result.installedScaffold.files).toHaveLength(70);
    expect(existsSync(join(target, 'src/pages/index.astro'))).toBe(true);
    expect(result.packageManager.name).toBe('bun');
  });

  it('refuses to install into a non-empty target', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'dirty');
    // Pre-create an arbitrary file the policy should reject on.
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'README.md'), 'occupied');
    await expect(
      initDirectory(target, { projectName: 'x', installScaffold, packageManager: pnpm }),
    ).rejects.toThrow(/not empty/);
  });
});
