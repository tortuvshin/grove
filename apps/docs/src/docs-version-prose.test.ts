import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// apps/docs/src/docs-version-prose.test.ts
//
// Stale-prose detector for the docs site. Walks every Markdown / MDX
// page under `apps/docs/src/content/docs/`, skips frontmatter and code
// fences, and asserts that none of the following strings appear:
//
//   - `0.5.0-next`, `0.5.0-next.2`, `0.5.0-next.x` — pre-release prose
//   - `V1 ships`, `V1 is`, `V1.1` — never-quite-arriving version
//   - `grove.dev.mn`, `open-apps.dev.mn` — old domain names
//   - `will land in`, `is planned` — aspirational outputs
//
// Status: this test is INTENTIONALLY `.skip()` until the docs migration
// rewrites the affected pages (Batch 7). Once all violations are gone,
// change `describe.skip` to `describe` to activate the gate.

const repoRoot = resolve(import.meta.dirname, '../../..');
const docsRoot = resolve(repoRoot, 'apps/docs/src/content/docs');

const FORBIDDEN = [
  '0.5.0-next',
  'V1 ships',
  'V1 is',
  'V1.1',
  'grove.dev.mn',
  'open-apps.dev.mn',
  'will land in',
  'is planned',
];

const EXCEPTIONS = new Set(['project/roadmap.md', 'reference/migration.md']);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) yield full;
  }
}

interface Violation {
  file: string;
  line: number;
  bad: string;
  text: string;
}

describe.skip('docs version-prose guard', () => {
  it('contains no forbidden pre-release / aspirational prose', async () => {
    const violations: Violation[] = [];
    for await (const file of walk(docsRoot)) {
      const rel = relative(docsRoot, file);
      if (EXCEPTIONS.has(rel)) continue;
      const src = await readFile(file, 'utf8');
      const lines = src.split('\n');
      let inFrontmatter = false;
      let inCode = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^---\s*$/.test(line)) {
          inFrontmatter = !inFrontmatter;
          continue;
        }
        if (inFrontmatter) continue;
        if (/^```/.test(line)) {
          inCode = !inCode;
          continue;
        }
        if (inCode) continue;
        for (const bad of FORBIDDEN) {
          if (line.includes(bad)) {
            violations.push({
              file: rel,
              line: i + 1,
              bad,
              text: line.trim().slice(0, 120),
            });
          }
        }
      }
    }
    expect(
      violations,
      violations.length > 0
        ? 'forbidden prose found:\n' +
            violations.map((v) => `  ${v.file}:${v.line} (${v.bad}) ${v.text}`).join('\n')
        : 'no forbidden strings',
    ).toEqual([]);
  });
});
