import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from './hash.js';
import { initDirectory } from './init.js';
import { loadItem, type RegistryItem, resolveBundledItemPath, writeItemFiles } from './registry.js';
import { runUpdate } from './update.js';

const installScaffold = async ({ target, itemPath }: { target: string; itemPath: string }) => {
  await writeItemFiles(await loadItem(itemPath), target);
};

const EDITED = 'src/components/ui/badge.astro';
const UNTOUCHED = 'src/components/ui/button.astro';

async function scaffold(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), 'grove-update-'));
  const cwd = join(parent, 'site');
  await initDirectory(cwd, { projectName: 'site', version: '1.0.0', installScaffold });
  return cwd;
}

function setContent(item: RegistryItem, target: string, content: string): void {
  const file = item.files.find((f) => f.target === `~/${target}`);
  if (!file) throw new Error(`${target} not in item`);
  file.content = content;
}

describe('grove update', () => {
  it('reports a fresh scaffold as fully unchanged', async () => {
    const cwd = await scaffold();
    const summary = await runUpdate({ cwd, from: resolveBundledItemPath(), check: true });
    expect(summary.exitCode).toBe(0);
    expect(summary.plan.unchanged).toHaveLength(70);
    expect(summary.plan.upstream_changed).toEqual([]);
    expect(summary.plan.new).toEqual([]);
    expect(summary.plan.locally_modified).toEqual([]);
    expect(summary.plan.conflict).toEqual([]);
    expect(summary.plan.removed).toEqual([]);
    expect(summary.applied).toEqual([]);
  });

  it('preserves a locally modified file when upstream is unchanged', async () => {
    const cwd = await scaffold();
    const mine = '---\n// my edit\n---\n';
    await writeFile(join(cwd, EDITED), mine);

    const summary = await runUpdate({ cwd, from: resolveBundledItemPath() });
    expect(summary.exitCode).toBe(0);
    expect(summary.plan.locally_modified).toEqual([EDITED]);
    expect(summary.preserved).toEqual([EDITED]);
    expect(summary.applied).toEqual([]);
    expect(await readFile(join(cwd, EDITED), 'utf8')).toBe(mine);
  });

  it('applies upstream changes, flags conflicts, and refreshes the lock', async () => {
    const cwd = await scaffold();
    const mine = '---\n// my edit\n---\n';
    await writeFile(join(cwd, EDITED), mine);

    // A newer upstream that changed both a file the user never touched
    // and the one they edited.
    const upstream = await loadItem(resolveBundledItemPath());
    const newButton = '---\n// upstream v2 button\n---\n';
    const newBadge = '---\n// upstream v2 badge\n---\n';
    setContent(upstream, UNTOUCHED, newButton);
    setContent(upstream, EDITED, newBadge);
    upstream.meta = { version: '2.0.0' };
    const from = join(await mkdtemp(join(tmpdir(), 'grove-upstream-')), 'default.json');
    await writeFile(from, JSON.stringify(upstream));

    const summary = await runUpdate({ cwd, from });
    expect(summary.exitCode).toBe(2);
    expect(summary.source).toBe(from);
    expect(summary.plan.upstream_changed).toEqual([UNTOUCHED]);
    expect(summary.plan.conflict).toEqual([EDITED]);
    expect(summary.plan.unchanged).toHaveLength(68);
    expect(summary.applied).toEqual([UNTOUCHED]);
    expect(summary.preserved).toEqual([EDITED]);

    // Disk: the untouched file took the upstream content, the edit survived.
    expect(await readFile(join(cwd, UNTOUCHED), 'utf8')).toBe(newButton);
    expect(await readFile(join(cwd, EDITED), 'utf8')).toBe(mine);

    // Lock: upstream hashes for what we wrote, the PREVIOUS hash for what
    // we preserved. Recording the upstream hash for a file that was never
    // written would make the lock claim content that is not on disk.
    const lock = JSON.parse(await readFile(join(cwd, '.grove/registry.lock.json'), 'utf8'));
    expect(lock.fileCount).toBe(70);
    expect(lock.files.find((f: { target: string }) => f.target === UNTOUCHED).hash).toBe(
      sha256(newButton),
    );
    expect(lock.files.find((f: { target: string }) => f.target === EDITED).hash).not.toBe(
      sha256(newBadge),
    );
    // And the version does not advance while a conflict is unresolved.
    expect(lock.scaffoldVersion).not.toBe('2.0.0');

    // Same upstream again: the conflict is still a conflict. Reporting it
    // once and then forgetting would hide a pending upstream change for
    // good, and drop CI's exit code from 2 to 0 on the second run.
    const again = await runUpdate({ cwd, from, check: true });
    expect(again.exitCode).toBe(2);
    expect(again.plan.conflict).toEqual([EDITED]);
    expect(again.plan.locally_modified).toEqual([]);
    expect(again.plan.unchanged).toHaveLength(69);
  });

  it('--force takes the upstream side of a conflict and then settles', async () => {
    const cwd = await scaffold();
    await writeFile(join(cwd, EDITED), '---\n// my edit\n---\n');

    const upstream = await loadItem(resolveBundledItemPath());
    const newBadge = '---\n// upstream v2 badge\n---\n';
    setContent(upstream, EDITED, newBadge);
    upstream.meta = { version: '2.0.0' };
    const from = join(await mkdtemp(join(tmpdir(), 'grove-upstream-')), 'default.json');
    await writeFile(from, JSON.stringify(upstream));

    const forced = await runUpdate({ cwd, from, force: true });
    expect(forced.exitCode).toBe(0);
    expect(forced.applied).toContain(EDITED);
    expect(forced.preserved).toEqual([]);
    expect(await readFile(join(cwd, EDITED), 'utf8')).toBe(newBadge);

    // Nothing left pending, so the lock may advance.
    const lock = JSON.parse(await readFile(join(cwd, '.grove/registry.lock.json'), 'utf8'));
    expect(lock.scaffoldVersion).toBe('2.0.0');
    const again = await runUpdate({ cwd, from, check: true });
    expect(again.plan.unchanged).toHaveLength(70);
  });

  it('a local edit upstream never touched is preserved, not overwritten, even with --force', async () => {
    const cwd = await scaffold();
    const mine = '---\n// my edit\n---\n';
    await writeFile(join(cwd, EDITED), mine);

    const forced = await runUpdate({ cwd, from: resolveBundledItemPath(), force: true });
    expect(forced.plan.locally_modified).toEqual([EDITED]);
    expect(forced.applied).toEqual([]);
    expect(await readFile(join(cwd, EDITED), 'utf8')).toBe(mine);
  });

  it('--diff renders a unified diff for every row upstream moved', async () => {
    const cwd = await scaffold();
    const upstream = await loadItem(resolveBundledItemPath());
    setContent(upstream, UNTOUCHED, '---\n// upstream v2 button\n---\n');
    const from = join(await mkdtemp(join(tmpdir(), 'grove-upstream-')), 'default.json');
    await writeFile(from, JSON.stringify(upstream));

    const withDiff = await runUpdate({ cwd, from, check: true, diff: true });
    expect(withDiff.diffs).toHaveLength(1);
    expect(withDiff.diffs[0]?.target).toBe(UNTOUCHED);
    expect(withDiff.diffs[0]?.patch).toContain('+// upstream v2 button');

    // Without the flag there is nothing to render.
    const withoutDiff = await runUpdate({ cwd, from, check: true });
    expect(withoutDiff.diffs).toEqual([]);
  });

  it('exits 1 without a lockfile', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'grove-nolock-'));
    const summary = await runUpdate({ cwd, from: resolveBundledItemPath(), check: true });
    expect(summary.exitCode).toBe(1);
  });
});
