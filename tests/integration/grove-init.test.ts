import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const cli = resolve(root, 'packages/cli/dist/index.js');

function run(args: string[], cwd: string): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('exit', (code) => (code === 0 ? done() : reject(new Error(output))));
  });
}

describe('grove init integration', () => {
  beforeAll(async () => {
    await new Promise<void>((done, reject) => {
      const child = spawn('pnpm', ['--filter', '@grove-dev/cli', 'build'], {
        cwd: root,
        stdio: 'pipe',
      });
      child.on('exit', (code) => (code === 0 ? done() : reject(new Error(`build exited ${code}`))));
    });
  });

  it('installs the @grove/default scaffold with the real shadcn CLI', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'grove-init-integration-'));
    // Workspace boundary. vitest sandboxes TMPDIR under the repo's
    // .tmp-test/, so without this pnpm (run by shadcn inside the
    // scaffold) walks up to the monorepo's pnpm-workspace.yaml and
    // records the throwaway project in the repo's own lockfile.
    await writeFile(join(parent, 'pnpm-workspace.yaml'), 'packages:\n  - open-apps\n');
    // Runs `pnpm dlx shadcn add <bundled default.json>` for real —
    // network required. `--no-install` only skips the final
    // `pnpm install`; shadcn still installs the item's own deps.
    await run(['init', 'open-apps', '--no-install', '--no-git'], parent);
    const target = join(parent, 'open-apps');

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('open-apps');
    expect(pkg.scripts).toMatchObject({
      dev: 'astro dev',
      build: 'astro build',
      check: 'astro check',
    });
    for (const dep of ['core', 'astro', 'cli', 'registry']) {
      expect(pkg.dependencies[`@grove-dev/${dep}`]).toMatch(/^\^\d+\.\d+\.\d+/);
    }
    // shadcn installed the item's npm dependencies with real ranges.
    expect(pkg.dependencies.astro).toMatch(/^\^\d/);
    expect(pkg.dependencies.tailwindcss).toMatch(/^\^\d/);

    const components = JSON.parse(await readFile(join(target, 'components.json'), 'utf8'));
    expect(components.registries['@grove']).toBe('https://withgrove.dev/r/{name}.json');

    expect(await readFile(join(target, 'src/pages/index.astro'), 'utf8')).toContain(
      'getHomePageModel(siteConfig)',
    );

    const lock = JSON.parse(await readFile(join(target, '.grove/registry.lock.json'), 'utf8'));
    expect(lock.scaffold).toBe('@grove/default');
    expect(lock.fileCount).toBe(70);

    expect(existsSync(join(target, 'data/generated/records.json'))).toBe(false);
    expect(existsSync(join(target, 'data/records/.gitkeep'))).toBe(true);
  });
});
