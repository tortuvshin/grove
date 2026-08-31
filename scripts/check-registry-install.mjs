#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Prove a single registry item installs the way the docs say it does.
 *
 * `grove init` only ever installs `@grove/default`, the one item that
 * inlines every file and therefore declares no `registryDependencies`.
 * The documented flow for everything else —
 *
 *     npx shadcn@latest add @grove/browse
 *
 * — resolves `registryDependencies` through the `@grove` entry in
 * `components.json`, and nothing exercised it. Its correctness rested
 * entirely on `validateRegistry()` deriving the same dependency set from
 * the relative-import graph, which is a static claim about a runtime
 * behaviour.
 *
 * So: serve the built registry over loopback, install one leaf item and
 * one item with a dependency chain, and check what actually lands on
 * disk. Loopback rather than withgrove.dev on purpose — this gate should
 * fail when the registry is wrong, not when the site is down.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const registryDist = join(root, 'packages/registry/dist/r');

if (!existsSync(join(registryDist, 'registry.json'))) {
  console.error('packages/registry/dist/r is missing — run `pnpm registry:build` first.');
  process.exit(1);
}

const shadcnVersion = JSON.parse(
  await readFile(join(root, 'packages/registry/package.json'), 'utf8'),
).devDependencies.shadcn;

/** What each item must pull in, including everything reachable through
 *  `registryDependencies`. Counted, not enumerated, so adding a file to
 *  an item does not churn this file — but dropping a whole dependency
 *  does show up. */
const CASES = [
  {
    item: 'ui',
    files: 7,
    mustInclude: ['src/components/ui/button.astro', 'src/lib/classnames.ts'],
  },
  {
    item: 'browse',
    files: 34,
    mustInclude: [
      'src/pages/[slug]/index.astro', // browse itself
      'src/layouts/base-layout.astro', // via @grove/shell
      'src/components/grove/project-card.astro', // via @grove/project-card
      'src/components/ui/button.astro', // via @grove/ui, transitively
    ],
  },
];

function run(command, args, cwd) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    );
  });
}

const server = createServer(async (request, response) => {
  const name = basename(new URL(request.url, 'http://localhost').pathname);
  try {
    const body = await readFile(join(registryDist, name), 'utf8');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const { port } = server.address();
const template = `http://127.0.0.1:${port}/{name}.json`;

let failures = 0;
try {
  for (const testCase of CASES) {
    const target = await mkdtemp(join(tmpdir(), `grove-item-${testCase.item}-`));
    await mkdir(join(target, 'src'), { recursive: true });
    await writeFile(
      join(target, 'package.json'),
      `${JSON.stringify({ name: 'probe', type: 'module', private: true }, null, 2)}\n`,
    );
    // shadcn refuses to run without a tsconfig, and needs `tsx: true` —
    // with `tsx: false` it runs its TS→JS transformer over every file and
    // dies on the first `.astro` with an opaque "Unexpected token".
    await writeFile(
      join(target, 'tsconfig.json'),
      `${JSON.stringify(
        {
          extends: 'astro/tsconfigs/base',
          compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] } },
          include: ['**/*'],
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(target, 'components.json'),
      `${JSON.stringify(
        {
          $schema: 'https://ui.shadcn.com/schema.json',
          style: 'new-york',
          rsc: false,
          tsx: true,
          tailwind: {
            config: '',
            css: 'src/styles/system.css',
            baseColor: 'neutral',
            cssVariables: true,
          },
          aliases: {
            components: '@/components',
            utils: '@/lib/utils',
            ui: '@/components/ui',
            lib: '@/lib',
          },
          registries: { '@grove': template },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(join(target, 'pnpm-lock.yaml'), '');

    await run(
      'npx',
      ['--yes', `shadcn@${shadcnVersion}`, 'add', `@grove/${testCase.item}`, '--yes'],
      target,
    );

    const missing = testCase.mustInclude.filter((file) => !existsSync(join(target, file)));
    if (missing.length > 0) {
      console.error(
        `\n@grove/${testCase.item}: these files never landed — a registryDependency did not resolve:`,
      );
      for (const file of missing) console.error(`  ${file}`);
      failures++;
      continue;
    }
    console.log(`@grove/${testCase.item}: installed with its full dependency chain.`);
  }
} finally {
  server.close();
}

if (failures > 0) process.exit(1);
console.log('Single-item registry installs OK.');
