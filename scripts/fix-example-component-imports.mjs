import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  '/Users/turtuvshin/Projects/research/grove/apps/example/src',
  '/Users/turtuvshin/Projects/research/grove/packages/registry/default',
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.astro')) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
let changed = 0;
for (const f of files) {
  let body = readFileSync(f, 'utf8');
  const before = body;
  body = body.replace(
    /from ['"]\.\.\/lib\/(search|display|lenses|format|repo|taxonomy-counts|pagination|facets|scores)['"]/g,
    'from "@grove-dev/core"',
  );
  body = body.replace(
    /from ['"]\.\.\/\.\.\/lib\/(search|display|lenses|format|repo|taxonomy-counts|pagination|facets|scores)['"]/g,
    'from "@grove-dev/core"',
  );
  if (body !== before) {
    writeFileSync(f, body);
    changed++;
  }
}
console.log(`Updated ${changed} files`);
