#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const parent = await mkdtemp(join(tmpdir(), 'grove-scaffold-'));
const target = join(parent, 'directory');
const packs = join(parent, 'packs');

function run(command, args, cwd = root) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

await run('pnpm', ['--filter', '@grove-dev/cli', 'build']);
await mkdir(packs);
for (const name of ['core', 'astro', 'cli']) {
  await run('pnpm', ['--filter', `@grove-dev/${name}`, 'pack', '--pack-destination', packs]);
}
await run(process.execPath, [
  resolve(root, 'packages/cli/dist/index.js'),
  'init',
  target,
  '--no-install',
  '--no-git',
]);

const packagePath = join(target, 'package.json');
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
const localPackages = {};
for (const name of ['core', 'astro', 'cli']) {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'packages', name, 'package.json'), 'utf8'),
  );
  localPackages[`@grove-dev/${name}`] =
    `file:${join(packs, `grove-dev-${name}-${manifest.version}.tgz`)}`;
}
Object.assign(pkg.dependencies, localPackages);
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(
  join(target, 'pnpm-workspace.yaml'),
  [
    'packages:',
    '  - .',
    'overrides:',
    ...Object.entries(localPackages).map(([name, value]) => `  '${name}': ${value}`),
    '',
  ].join('\n'),
);

await run('pnpm', ['install', '--no-frozen-lockfile'], target);
await run('pnpm', ['exec', 'grove', 'check'], target);
await run('pnpm', ['build'], target);
console.log(`\nScaffold smoke passed: ${target}`);

// ── Second pass: a real directory on non-default routes ──────────────
//
// The pass above builds the default scaffold with zero records, so it
// renders no taxonomy detail page and no record page, and it browses at
// the default `/projects`. Both gaps hid a real bug: `taxonomy-list.astro`
// defaulted its back link and every card href to a hardcoded `/projects`,
// so on a site configured with `routes.directory: "apps"` all 33 links
// across the twelve taxonomy pages 404'd. Nothing in CI could see it.
//
// So: same install, real records, and a directory route that is NOT the
// default. Then assert the built HTML never links to the default route.
console.log('\nSecond pass: non-default routes with real records…');

for (const dir of ['data/records', 'data/taxonomy', 'data/collections']) {
  await cp(resolve(root, 'apps/example', dir), join(target, dir), { recursive: true });
}
await cp(resolve(root, 'apps/example/data/health.yml'), join(target, 'data/health.yml'));
await cp(resolve(root, 'apps/example/content'), join(target, 'content'), { recursive: true });

await writeFile(
  join(target, 'grove.config.ts'),
  `import { defineConfig } from '@grove-dev/core';

export default defineConfig({
  blueprint: 'project-directory',
  site: {
    name: 'Route Fixture',
    tagline: 'Browses at /apps, not /projects.',
    description: 'Proves the scaffold honours routes.directory everywhere.',
    url: 'https://fixture.example.com',
  },
  routes: { directory: 'apps', item: 'app' },
  labels: { singular: 'app', plural: 'apps' },
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Browse', href: '/apps' },
    { label: 'About', href: '/about' },
  ],
  browse: { facets: ['category', 'stack', 'platform', 'license'] },
  theme: { radius: 'soft', density: 'comfortable', containerWidth: '72rem' },
});
`,
);

await run('pnpm', ['exec', 'grove', 'check'], target);
await run('pnpm', ['build'], target);

const dist = join(target, 'dist');
const offenders = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    const dead = html.match(/href="\/projects[^"]*"/g);
    if (dead) offenders.push(`${relative(dist, path)} → ${[...new Set(dead)].join(', ')}`);
  }
}
await walk(dist);

if (offenders.length > 0) {
  console.error(
    `\nBuilt HTML links to /projects on a site that browses at /apps ` +
      `— ${offenders.length} page(s) with dead links:`,
  );
  for (const offender of offenders) console.error(`  ${offender}`);
  console.error('\nA component is hardcoding the directory route instead of using indexSlug().');
  process.exit(1);
}

// And the routes it should have produced really exist.
for (const page of ['apps/index.html', 'apps/crewai/index.html', 'categories/agents/index.html']) {
  if (!existsSync(join(dist, page))) {
    console.error(`\nExpected ${page} in the build output; it is missing.`);
    process.exit(1);
  }
}

console.log(`Non-default-route smoke passed: no /projects links, /apps routes present.`);
