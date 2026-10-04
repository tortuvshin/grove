#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// `--pm=npm` / `--pm=bun` runs the same smoke as that package manager's
// user would: `grove init` detects it from npm_config_user_agent, the
// way it does under `npx` or `bunx`, and every later step uses it.
const pm = process.argv.find((arg) => arg.startsWith('--pm='))?.slice(5) ?? 'pnpm';
if (!['pnpm', 'npm', 'bun'].includes(pm)) {
  console.error(`Unknown --pm=${pm}; expected pnpm, npm or bun.`);
  process.exit(1);
}
const exec = { pnpm: ['pnpm', 'exec'], npm: ['npx', '--no'], bun: ['bunx'] }[pm];
const parent = await mkdtemp(join(tmpdir(), 'grove-scaffold-'));
const target = join(parent, 'directory');
const packs = join(parent, 'packs');

function run(command, args, cwd = root, env = process.env) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
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
await run(
  process.execPath,
  [resolve(root, 'packages/cli/dist/index.js'), 'init', target, '--no-install', '--no-git'],
  // Not `root`: its package.json pins pnpm, which detection would honour.
  parent,
  { ...process.env, npm_config_user_agent: `${pm}/0.0.0 node/${process.version}` },
);

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
if (pm === 'pnpm') {
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  // Append, never replace: `grove init` already wrote this file to approve
  // the scaffold's dependency build scripts, and pnpm 11 fails the install
  // below with ERR_PNPM_IGNORED_BUILDS if that approval goes missing.
  const scaffoldWorkspace = await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8');
  await writeFile(
    join(target, 'pnpm-workspace.yaml'),
    [
      scaffoldWorkspace.trimEnd(),
      'packages:',
      '  - .',
      'overrides:',
      ...Object.entries(localPackages).map(([name, value]) => `  '${name}': ${value}`),
      '',
    ].join('\n'),
  );
} else {
  // npm and bun read overrides from package.json; they pin the CLI's own
  // dependency on @grove-dev/core to the local tarball too.
  if (existsSync(join(target, 'pnpm-workspace.yaml'))) {
    console.error(`\ngrove init wrote pnpm-workspace.yaml for a ${pm} project.`);
    process.exit(1);
  }
  pkg.overrides = { ...localPackages };
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}
if (!pkg.packageManager?.startsWith(`${pm}@`)) {
  console.error(`\ngrove init recorded packageManager ${pkg.packageManager}, expected ${pm}.`);
  process.exit(1);
}

await run(pm, pm === 'pnpm' ? ['install', '--no-frozen-lockfile'] : ['install'], target);
await run(exec[0], [...exec.slice(1), 'grove', 'check'], target);
await run(pm, ['run', 'build'], target);
// The sample record `grove init` writes renders as a real detail page.
if (!existsSync(join(target, 'dist/projects/grove/index.html'))) {
  console.error('\nExpected the sample record at dist/projects/grove/index.html; it is missing.');
  process.exit(1);
}
console.log(`\nScaffold smoke passed (${pm}): ${target}`);

// ── Second pass: a real directory on non-default routes ──────────────
//
// The pass above builds the default scaffold with one uncategorised
// sample record, so it renders no taxonomy detail page, and it browses
// at the default `/projects`. Both gaps hid a real bug: `taxonomy-list.astro`
// defaulted its back link and every card href to a hardcoded `/projects`,
// so on a site configured with `routes.directory: "apps"` all 33 links
// across the twelve taxonomy pages 404'd. Nothing in CI could see it.
//
// So: same install, real records, and a directory route that is NOT the
// default. Then assert the built HTML never links to the default route.
console.log('\nSecond pass: non-default routes with real records…');

for (const dir of ['data/taxonomy', 'data/collections']) {
  await cp(resolve(root, 'apps/example', dir), join(target, dir), { recursive: true });
}
await cp(resolve(root, 'apps/example/data/health.yml'), join(target, 'data/health.yml'));
// The example's records replace the scaffold's sample one, whose
// category is not in the example taxonomy.
await rm(join(target, 'content/records'), { recursive: true, force: true });
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

await run(exec[0], [...exec.slice(1), 'grove', 'check'], target);
await run(pm, ['run', 'build'], target);

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
