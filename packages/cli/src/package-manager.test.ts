import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectPackageManager,
  dlxCommand,
  installCommand,
  localBin,
  parseUserAgent,
  runScriptCommand,
} from './package-manager.js';

describe('package manager detection', () => {
  it('reads the manager and version out of a user agent', () => {
    // The exact strings npx, pnpm dlx, yarn dlx and bunx export.
    expect(parseUserAgent('pnpm/10.12.1 npm/? node/v22.22.2 darwin arm64')).toEqual({
      name: 'pnpm',
      version: '10.12.1',
    });
    expect(parseUserAgent('npm/10.9.7 node/v22.22.2 darwin arm64 workspaces/false')).toEqual({
      name: 'npm',
      version: '10.9.7',
    });
    expect(parseUserAgent('yarn/1.22.22 npm/? node/v22.22.2 darwin arm64')).toEqual({
      name: 'yarn',
      version: '1.22.22',
    });
    expect(parseUserAgent('bun/1.2.21 npm/? node/v22.0.0 darwin arm64')).toEqual({
      name: 'bun',
      version: '1.2.21',
    });
  });

  it('ignores a user agent it cannot use', () => {
    expect(parseUserAgent(undefined)).toBeNull();
    expect(parseUserAgent('')).toBeNull();
    expect(parseUserAgent('deno/2.0.0')).toBeNull();
    // npm writes `?` when it does not know its own version.
    expect(parseUserAgent('npm/? node/v22.22.2')).toEqual({ name: 'npm' });
  });

  it("prefers the project's explicit choice over its lockfile", async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grove-pm-'));
    await writeFile(join(dir, 'package.json'), JSON.stringify({ packageManager: 'bun@1.2.21' }));
    await writeFile(join(dir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(dir)).toEqual({ name: 'bun', version: '1.2.21' });
  });

  it('drops the integrity suffix corepack writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grove-pm-'));
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.12.1+sha512.abc123' }),
    );
    expect(detectPackageManager(dir)).toEqual({ name: 'pnpm', version: '10.12.1' });
  });

  it('falls back to the lockfile a project has been living with', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'grove-pm-'));
    await writeFile(join(dir, 'package.json'), '{}');
    await writeFile(join(dir, 'yarn.lock'), '');
    expect(detectPackageManager(dir)).toEqual({ name: 'yarn' });
  });
});

describe('package manager commands', () => {
  it('installs with the manager itself', () => {
    expect(installCommand({ name: 'bun' })).toEqual(['bun', ['install']]);
    expect(installCommand({ name: 'npm' })).toEqual(['npm', ['install']]);
  });

  it('always names scripts with `run`, which all four accept', () => {
    // `pnpm dev` works but `npm dev` does not, so the printed next step
    // has to use the long form for everyone.
    expect(runScriptCommand({ name: 'npm' }, 'dev')).toBe('npm run dev');
    expect(runScriptCommand({ name: 'pnpm' }, 'dev')).toBe('pnpm run dev');
  });

  it('fetches a remote package the way each manager spells it', () => {
    expect(dlxCommand({ name: 'pnpm' }, 'shadcn@4.19.0', ['add'])).toEqual([
      'pnpm',
      ['dlx', 'shadcn@4.19.0', 'add'],
    ]);
    expect(dlxCommand({ name: 'bun' }, 'shadcn@4.19.0', ['add'])).toEqual([
      'bunx',
      ['shadcn@4.19.0', 'add'],
    ]);
    expect(dlxCommand({ name: 'npm' }, 'shadcn@4.19.0', ['add'])).toEqual([
      'npm',
      ['exec', '--yes', '--', 'shadcn@4.19.0', 'add'],
    ]);
  });

  it('routes Yarn Classic around a `dlx` it does not have', () => {
    // `yarn dlx` is parsed as `yarn run dlx` on 1.x and fails.
    expect(dlxCommand({ name: 'yarn', version: '1.22.22' }, 'shadcn@4.19.0', ['add'])).toEqual([
      'npx',
      ['--yes', 'shadcn@4.19.0', 'add'],
    ]);
    expect(dlxCommand({ name: 'yarn', version: '4.5.0' }, 'shadcn@4.19.0', ['add'])).toEqual([
      'yarn',
      ['dlx', 'shadcn@4.19.0', 'add'],
    ]);
  });

  it('points at the project binary, not a package manager', () => {
    expect(localBin('/tmp/space', 'astro')).toBe(
      process.platform === 'win32'
        ? '/tmp/space/node_modules/.bin/astro.cmd'.replaceAll('/', '\\')
        : '/tmp/space/node_modules/.bin/astro',
    );
  });
});
