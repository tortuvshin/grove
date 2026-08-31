import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

describe('grove init (registry scaffold)', () => {
  it('scaffolds a project around the @grove/default item', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'ai-stack');
    const result = await initDirectory(target, {
      projectName: 'AI Stack',
      version: '9.8.7',
      installScaffold,
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

    // Return value surfaces what was installed.
    expect(result.installedScaffold.name).toBe('default');
    expect(result.installedScaffold.files).toHaveLength(70);
  });

  it('refuses to install into a non-empty target', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-'));
    const target = join(parent, 'dirty');
    // Pre-create an arbitrary file the policy should reject on.
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'README.md'), 'occupied');
    await expect(initDirectory(target, { projectName: 'x', installScaffold })).rejects.toThrow(
      /not empty/,
    );
  });
});
