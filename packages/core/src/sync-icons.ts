/**
 * Sync a packaged icon set into a site's `public/icons/`.
 *
 * `Icon.astro` resolves every mark to `/icons/**`, so the SVGs have to
 * exist in the consumer's `public/` before the build asks for them.
 * Two callers supply the source directory:
 *
 *   - `@grove-dev/astro` — its own `assets/icons/`, on every build, so
 *     the component and the files it points at can never drift apart.
 *   - `@grove-dev/cli` — the packaged scaffold, via `grove icons sync`,
 *     as the explicit escape hatch for restoring edited files.
 *
 * Ownership is tracked by a sha256 sidecar at
 * `<publicDir>/icons/.grove-icons.json` — the same "Grove owns this
 * file until you edit it" contract as `writeOwnedArtifact` in
 * `site-artifacts.ts`, expressed as hashes rather than an embedded
 * marker comment. A marker inside an SVG would corrupt the
 * byte-for-byte drift check against the vendored upstream artwork.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const MANIFEST_NAME = '.grove-icons.json';

interface IconManifest {
  /** Relative path (`stacks/apple.svg`) → sha256 of the bytes Grove wrote. */
  files: Record<string, string>;
}

export interface IconSyncResult {
  /** Files created or refreshed, relative to `<publicDir>/icons`. */
  written: string[];
  /** Files left alone because the consumer had edited them. */
  skipped: string[];
  /** Files removed because they are no longer part of the packaged set. */
  pruned: string[];
  /**
   * True on the first sync into a site that predates the sidecar. See
   * the adoption note in `syncIconAssets` — callers should surface this
   * so the one-time overwrite is visible rather than silent.
   */
  adopted: boolean;
}

export interface IconSyncOptions {
  /** Overwrite consumer edits and restore the packaged version. */
  force?: boolean;
  /**
   * Also delete SVGs under `icons/{stacks,platforms}` that are not in
   * the packaged set. Off by default — a consumer's own icons live
   * there too. `grove icons sync --force` turns it on.
   */
  prune?: boolean;
  /** Report what would change without touching the filesystem. */
  dryRun?: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readManifest(path: string): Promise<IconManifest> {
  if (!existsSync(path)) return { files: {} };
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as IconManifest;
    return { files: parsed.files ?? {} };
  } catch {
    // A corrupt sidecar means "we no longer know what we own" — treat
    // every existing file as consumer-owned rather than clobbering it.
    return { files: {} };
  }
}

/**
 * Copy `sourceIconsDir` into `<publicDir>/icons`, leaving any file the
 * consumer has edited untouched.
 *
 * `sourceIconsDir` must contain the `.grove-icons.json` manifest that
 * `scripts/sync-icons.mjs` generates; without it this is a no-op.
 */
export async function syncIconAssets(
  sourceIconsDir: string,
  publicDir: string,
  options: IconSyncOptions = {},
): Promise<IconSyncResult> {
  const result: IconSyncResult = {
    written: [],
    skipped: [],
    pruned: [],
    adopted: false,
  };
  const sourceManifestPath = resolve(sourceIconsDir, MANIFEST_NAME);
  if (!existsSync(sourceManifestPath)) return result;

  const packaged = await readManifest(sourceManifestPath);
  const targetRoot = resolve(publicDir, 'icons');
  const targetManifestPath = resolve(targetRoot, MANIFEST_NAME);
  const previous = await readManifest(targetManifestPath);
  const { dryRun = false } = options;

  // Adoption: a site with icons but no sidecar predates this mechanism,
  // so its `public/icons/` came from `grove init` — Grove wrote those
  // files, we just never recorded it. Without this, every existing site
  // would classify all ~40 scaffold icons as "locally modified" and
  // keep the very artwork this sync exists to replace.
  //
  // The overwrite is limited to names in the packaged set (a
  // consumer's own icons are never touched) and happens exactly once,
  // and the caller reports it so a genuine pre-sidecar edit is
  // recoverable from version control rather than lost silently.
  // Keyed on "we have never recorded owning anything here", not on the
  // sidecar's existence: an interrupted first run can leave an empty
  // sidecar behind, and treating that as "fully adopted" would lock the
  // site out of the migration forever.
  const adopting = existsSync(targetRoot) && Object.keys(previous.files).length === 0;
  result.adopted = adopting;

  const owned: Record<string, string> = {};

  for (const [relativePath, packagedHash] of Object.entries(packaged.files)) {
    const source = resolve(sourceIconsDir, relativePath);
    if (!existsSync(source)) continue;
    const target = resolve(targetRoot, relativePath);

    if (existsSync(target)) {
      const current = sha256(await readFile(target, 'utf8'));
      if (current === packagedHash) {
        // Already the packaged version — nothing to do, still ours.
        owned[relativePath] = packagedHash;
        continue;
      }
      const recorded = previous.files[relativePath];
      const untouched = recorded !== undefined && recorded === current;
      if (!untouched && !adopting && !options.force) {
        result.skipped.push(relativePath);
        continue;
      }
    }

    if (!dryRun) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(source, 'utf8'));
    }
    owned[relativePath] = packagedHash;
    result.written.push(relativePath);
  }

  // Retire files Grove used to own — the `-light`/`-dark` theme pairs
  // and any icon dropped from the set — but only when we can prove we
  // wrote them and the consumer has not edited them since.
  for (const [relativePath, recorded] of Object.entries(previous.files)) {
    if (relativePath in packaged.files) continue;
    const target = resolve(targetRoot, relativePath);
    if (!existsSync(target)) continue;
    if (sha256(await readFile(target, 'utf8')) !== recorded) continue;
    if (!dryRun) await rm(target, { force: true });
    result.pruned.push(relativePath);
  }

  if (options.prune || adopting) {
    // `--prune` removes anything outside the packaged set. Adoption
    // removes only the retired `-light`/`-dark` theme pairs: nothing
    // requests those file names any more, so they are dead weight
    // rather than a consumer's working icon.
    const retiredPair = /-(light|dark)\.svg$/;
    for (const folder of ['stacks', 'platforms']) {
      const dir = resolve(targetRoot, folder);
      if (!existsSync(dir)) continue;
      for (const entry of await readdir(dir)) {
        if (!entry.endsWith('.svg')) continue;
        const relativePath = `${folder}/${entry}`;
        if (relativePath in packaged.files) continue;
        if (result.pruned.includes(relativePath)) continue;
        if (!options.prune && !retiredPair.test(entry)) continue;
        if (!dryRun) await rm(resolve(dir, entry), { force: true });
        result.pruned.push(relativePath);
      }
    }
  }

  if (dryRun) return result;

  // Never leave an empty sidecar: it records nothing and would make the
  // site look already-adopted on the next run.
  if (Object.keys(owned).length === 0) return result;

  const next = `${JSON.stringify({ files: owned }, null, 2)}\n`;
  const currentSidecar = existsSync(targetManifestPath)
    ? await readFile(targetManifestPath, 'utf8')
    : '';
  if (next !== currentSidecar) {
    await mkdir(targetRoot, { recursive: true });
    await writeFile(targetManifestPath, next);
  }

  return result;
}
