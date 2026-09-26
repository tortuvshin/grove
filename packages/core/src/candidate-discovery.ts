/**
 * Pure helpers for candidate collection: which repository files are
 * worth reading, and what the files and package indexes say. The
 * network side is in `candidate-collector.ts`; nothing here fetches.
 */

export interface TreeFile {
  path: string;
  /** Git blob SHA. */
  sha: string;
  /** Size in bytes, as the git tree reports it. */
  size?: number;
}

/**
 * Directories never searched: dependencies and vendored code (their
 * icons belong to someone else), docs and `.github` (README images),
 * tests, examples and build output.
 */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor',
  'vendors',
  'third_party',
  'third-party',
  'thirdparty',
  'external',
  'externals',
  'deps',
  'pods',
  'carthage',
  '.github',
  '.gitlab',
  'docs',
  'doc',
  'documentation',
  'wiki',
  'test',
  'tests',
  '__tests__',
  '__mocks__',
  'spec',
  'fixtures',
  'testdata',
  'example',
  'examples',
  'sample',
  'samples',
  'demo',
  'demos',
  'dist',
  'build',
  'out',
  'target',
  '.dart_tool',
  '.yarn',
  '.git',
]);

/** Words in a file name that mark a banner, card or README image, never a logo. */
const EXCLUDED_NAME =
  /banner|screenshot|screen[-_]?shot|readme|social|og[-_]?image|opengraph|preview|cover|header|hero|splash|feature[-_]?graphic|promo|sponsor|badge|wallpaper|mockup|showcase|tv[-_]?banner/i;

/** Directories an app keeps its own brand assets in. */
const ASSET_DIRS = new Set([
  'assets',
  'asset',
  'public',
  'static',
  'resources',
  'branding',
  'brand',
  'logo',
  'logos',
  'icons',
  'packaging',
  'art',
  'artwork',
  'media',
]);

const IMAGE_EXT = /\.(png|svg|webp)$/i;
const SCREENSHOT_EXT = /\.(png|jpe?g|webp)$/i;

function segments(path: string): string[] {
  return path.split('/');
}

/** True when a path runs through a dependency, docs, test or build directory. */
export function isExcludedPath(path: string): boolean {
  const parts = segments(path);
  return parts.slice(0, -1).some((part) => EXCLUDED_DIRS.has(part.toLowerCase()));
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function depth(path: string): number {
  return segments(path).length;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LOGO_MODIFIER =
  '(?:\\d+(?:x\\d+)?|\\d+px|@?\\dx|light|dark|colou?r(?:ed)?|full|square|round(?:ed)?|mark|white|black|transparent|large|mono(?:chrome)?|text|horizontal|vertical|wordmark|primary|default|rounded)';

function logoNamePattern(repo: string): RegExp {
  const name = escapeRegex(repo.toLowerCase());
  return new RegExp(
    `^(?:${name}[-_ ]?)?(?:app[-_ ]?)?(?:logo|icon|logomark|logo[-_]mark)(?:[-_.@ ]?${LOGO_MODIFIER})*$`,
    'i',
  );
}

/** A size encoded in a file name (`icon-32`, `logo_16x16`), when there is one. */
function namedSize(name: string): number | undefined {
  const match = /(?:^|[-_.@x])(\d{2,4})(?:x\d{2,4})?(?:px)?(?:$|[-_.@])/i.exec(name);
  return match ? Number(match[1]) : undefined;
}

export interface FastlaneFiles {
  /** Directory holding `fastlane/`, e.g. `` or `mobile/android`. */
  root: string;
  locale: string;
  icon?: TreeFile;
  screenshots: TreeFile[];
}

const FASTLANE = /^(?:(.*)\/)?fastlane\/metadata\/android\/([^/]+)\/images\/(.+)$/;

const LOCALE_PREFERENCE = ['en-US', 'en-GB', 'en'];

function pickLocale(locales: string[]): string | undefined {
  for (const preferred of LOCALE_PREFERENCE) if (locales.includes(preferred)) return preferred;
  return [...locales].sort()[0];
}

/**
 * The fastlane (F-Droid / Play) metadata of the repository: its icon
 * and phone screenshots in one locale (en-US first). The shallowest
 * fastlane directory wins when there are several.
 */
export function findFastlane(
  files: readonly TreeFile[],
  maxScreenshots = 8,
): FastlaneFiles | undefined {
  const byRoot = new Map<string, Map<string, { icon?: TreeFile; screenshots: TreeFile[] }>>();
  for (const file of files) {
    const match = FASTLANE.exec(file.path);
    if (!match || isExcludedPath(file.path)) continue;
    const root = match[1] ?? '';
    const locale = match[2] ?? '';
    const rest = match[3] ?? '';
    const locales = byRoot.get(root) ?? new Map();
    byRoot.set(root, locales);
    const bucket = locales.get(locale) ?? { screenshots: [] };
    locales.set(locale, bucket);
    if (/^icon\.(png|jpe?g|webp)$/i.test(rest)) bucket.icon = file;
    else if (/^phoneScreenshots\/[^/]+$/.test(rest) && SCREENSHOT_EXT.test(rest)) {
      bucket.screenshots.push(file);
    }
  }
  const roots = [...byRoot.keys()].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  for (const root of roots) {
    const locales = byRoot.get(root);
    if (!locales) continue;
    const withContent = [...locales.entries()].filter(
      ([, bucket]) => bucket.icon || bucket.screenshots.length > 0,
    );
    const locale = pickLocale(withContent.map(([name]) => name));
    const bucket = locale ? locales.get(locale) : undefined;
    if (!locale || !bucket) continue;
    const screenshots = [...bucket.screenshots]
      .sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))
      .slice(0, maxScreenshots);
    return { root, locale, ...(bucket.icon ? { icon: bucket.icon } : {}), screenshots };
  }
  return undefined;
}

/**
 * Gradle build files of Android app modules, the ones next to a
 * fastlane directory first. They hold the `applicationId` F-Droid
 * lists the app under.
 */
export function findGradleAppFiles(
  files: readonly TreeFile[],
  fastlaneRoot?: string,
  max = 2,
): TreeFile[] {
  const all = files.filter((file) => {
    if (isExcludedPath(file.path)) return false;
    if (!/(^|\/)build\.gradle(\.kts)?$/.test(file.path)) return false;
    const dir = dirname(file.path);
    return basename(dir) === 'app' || /(^|\/)android(\/|$)/.test(dir);
  });
  // `applicationId` lives in the app module; a root build file is
  // only worth reading when there is no `app/` module at all.
  const appModules = all.filter((file) => basename(dirname(file.path)) === 'app');
  const gradle = appModules.length > 0 ? appModules : all;
  const near = (path: string) =>
    fastlaneRoot !== undefined && (fastlaneRoot === '' || path.startsWith(`${fastlaneRoot}/`))
      ? 0
      : 1;
  const isAppModule = (path: string) => (basename(dirname(path)) === 'app' ? 0 : 1);
  return gradle
    .sort(
      (a, b) =>
        near(a.path) - near(b.path) ||
        isAppModule(a.path) - isAppModule(b.path) ||
        depth(a.path) - depth(b.path) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, max);
}

/** Every `applicationId` a Gradle file declares (default config and flavors). */
export function parseGradleApplicationIds(text: string): string[] {
  const ids = new Set<string>();
  const pattern = /\bapplicationId\s*(?:=\s*)?\(?\s*["']([A-Za-z][\w]*(?:\.[A-Za-z_][\w]*)+)["']/g;
  for (const match of text.matchAll(pattern)) if (match[1]) ids.add(match[1]);
  return [...ids];
}

const METAINFO = /\.(metainfo|appdata)\.xml(\.in)?$/i;

/** AppStream metainfo files, shallowest first. */
export function findMetainfoFiles(files: readonly TreeFile[], max = 2): TreeFile[] {
  return files
    .filter((file) => METAINFO.test(file.path) && !isExcludedPath(file.path))
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .slice(0, max);
}

export interface AppstreamFacts {
  id?: string;
  /** `<icon type="remote">` URLs. */
  icons: string[];
  /** `<screenshot><image>` URLs, source images preferred over thumbnails. */
  screenshots: string[];
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

/** The app id, remote icons and screenshots an AppStream metainfo file declares. */
export function parseAppstream(text: string, fileName = ''): AppstreamFacts {
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
  const rawId = /<id(?:\s[^>]*)?>([^<]+)<\/id>/.exec(withoutComments)?.[1];
  const fromFile = basename(fileName).replace(METAINFO, '');
  const id = (rawId ? decodeXml(rawId) : fromFile).replace(/\.desktop$/, '') || undefined;
  const icons: string[] = [];
  for (const match of withoutComments.matchAll(/<icon\b([^>]*)>([^<]+)<\/icon>/g)) {
    if (/type\s*=\s*["']remote["']/.test(match[1] ?? '') && match[2])
      icons.push(decodeXml(match[2]));
  }
  const screenshots: string[] = [];
  for (const shot of withoutComments.matchAll(/<screenshot\b[^>]*>([\s\S]*?)<\/screenshot>/g)) {
    const images = [...(shot[1] ?? '').matchAll(/<image\b([^>]*)>([^<]+)<\/image>/g)];
    const source = images.find((m) => !/type\s*=\s*["']thumbnail["']/.test(m[1] ?? ''));
    const url = source?.[2] ?? images[0]?.[2];
    if (url) screenshots.push(decodeXml(url));
  }
  return {
    ...(id && /^[\w.-]+$/.test(id) ? { id } : {}),
    icons: [...new Set(icons)].filter((u) => /^https?:\/\//.test(u)),
    screenshots: [...new Set(screenshots)].filter((u) => /^https?:\/\//.test(u)),
  };
}

const MANIFEST =
  /(^|\/)(manifest\.json|manifest\.webmanifest|site\.webmanifest|[\w.-]+\.webmanifest)$/i;

/** Web app manifests under a web root (`public/`, `static/`, `web/`, …), shallowest first. */
export function findWebManifests(files: readonly TreeFile[], max = 2): TreeFile[] {
  return files
    .filter((file) => {
      if (!MANIFEST.test(file.path) || isExcludedPath(file.path)) return false;
      if (/\.webmanifest$/i.test(file.path)) return true;
      // `manifest.json` is also a browser-extension and tooling file
      // name; only look at the ones in a web root.
      return segments(file.path)
        .slice(0, -1)
        .some((part) => ['public', 'static', 'web', 'www', 'app'].includes(part.toLowerCase()));
    })
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .slice(0, max);
}

/**
 * The best icon a web app manifest declares, resolved to a repository
 * path: `/x.png` against the manifest's directory (the web root), a
 * relative `src` against the same directory. Maskable-only and
 * monochrome icons are skipped; SVG, then the largest size, wins.
 */
export function pickManifestIcon(text: string, manifestPath: string): string | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const manifest = json as Record<string, unknown>;
  if (!manifest || typeof manifest !== 'object' || 'manifest_version' in manifest) return undefined;
  if (!Array.isArray(manifest.icons)) return undefined;
  const root = dirname(manifestPath);
  let best: { path: string; score: number } | undefined;
  for (const raw of manifest.icons) {
    const icon = raw as Record<string, unknown>;
    const src = typeof icon?.src === 'string' ? icon.src.split(/[?#]/)[0] : undefined;
    if (!src || /^[a-z]+:/i.test(src) || src.startsWith('//')) continue;
    // Splash screens and tiles ride along in generated manifests.
    if (!IMAGE_EXT.test(src) || EXCLUDED_NAME.test(basename(src))) continue;
    const purpose = typeof icon.purpose === 'string' ? icon.purpose.split(/\s+/) : ['any'];
    if (!purpose.includes('any')) continue;
    const sizes = typeof icon.sizes === 'string' ? icon.sizes : '';
    const largest = Math.max(
      0,
      ...sizes.split(/\s+/).map((s) => Number(/^(\d+)x\d+$/i.exec(s)?.[1] ?? 0)),
    );
    const score = /\.svg$/i.test(src) || sizes === 'any' ? 100_000 : largest;
    const joined = src.startsWith('/') ? `${root}${src}` : `${root}/${src}`;
    const path = normalizePath(joined);
    if (!best || score > best.score) best = { path, score };
  }
  return best?.path;
}

/** The path up to the first asset directory: the package a file belongs to. */
function packageRoot(path: string): string {
  const parts = segments(path).slice(0, -1);
  const i = parts.findIndex((part) => ASSET_DIRS.has(part.toLowerCase()));
  return parts.slice(0, i < 0 ? parts.length : i).join('/');
}

function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/**
 * Files that look like the app's own logo: `logo*` / `icon*` /
 * `<repo>-logo*` PNG, SVG or WebP inside an asset directory
 * (`assets/`, `public/`, `branding/`, …). Favicon-sized files, banners
 * and anything under a dependency, docs or test directory are skipped.
 * SVG first, then shallower paths.
 */
export function findAssetLogos(files: readonly TreeFile[], repo: string, max = 3): TreeFile[] {
  const pattern = logoNamePattern(repo);
  const matches = files.filter((file) => {
    if (!IMAGE_EXT.test(file.path) || isExcludedPath(file.path)) return false;
    const name = basename(file.path).replace(IMAGE_EXT, '');
    if (EXCLUDED_NAME.test(name) || !pattern.test(name)) return false;
    const size = namedSize(name);
    if (size !== undefined && size < 128) return false;
    const dirs = segments(file.path).slice(0, -1);
    return dirs.some((part) => ASSET_DIRS.has(part.toLowerCase()));
  });
  // The same file name in three or more sibling packages
  // (`addons/*/resources/icon.png`, `apps/*/public/logo.svg`) is a
  // plugin or package convention, not the app's logo.
  const parents = new Map<string, Set<string>>();
  for (const file of matches) {
    const name = basename(file.path).toLowerCase();
    const set = parents.get(name) ?? new Set<string>();
    set.add(packageRoot(file.path));
    parents.set(name, set);
  }
  return matches
    .filter((file) => (parents.get(basename(file.path).toLowerCase())?.size ?? 0) < 3)
    .sort((a, b) => {
      const svg = (path: string) => (/\.svg$/i.test(path) ? 0 : 1);
      return (
        svg(a.path) - svg(b.path) || depth(a.path) - depth(b.path) || a.path.localeCompare(b.path)
      );
    })
    .slice(0, max);
}

// ── Release assets ─────────────────────────────────────────────────

const INSTALLABLE: Array<[RegExp, string]> = [
  [/\.apk$/i, 'android'],
  [/\.ipa$/i, 'ios'],
  [/\.(dmg|pkg)$/i, 'macos'],
  [/\.(msi|msix|exe)$/i, 'windows'],
  [/\.(appimage|deb|rpm|flatpak|snap)$/i, 'linux'],
];

/** Assets that are not for end users even with an installable extension. */
const NOT_FOR_USERS = /debug|symbols|unsigned|uninstall|\.blockmap$/i;

/** Installable release assets grouped by platform, names sorted. */
export function installableAssets(names: readonly string[]): Map<string, string[]> {
  const byPlatform = new Map<string, string[]>();
  for (const name of names) {
    if (NOT_FOR_USERS.test(name)) continue;
    const platform = INSTALLABLE.find(([pattern]) => pattern.test(name))?.[1];
    if (!platform) continue;
    const list = byPlatform.get(platform) ?? [];
    list.push(name);
    byPlatform.set(platform, list);
  }
  for (const list of byPlatform.values()) list.sort();
  return byPlatform;
}

// ── Repology ───────────────────────────────────────────────────────

export interface RepologyPackage {
  repo?: string;
  srcname?: string;
  binname?: string;
  visiblename?: string;
  version?: string;
}

export interface RepologyChannel {
  type: string;
  platform: string;
  label: string;
  url: string;
  /** Repology repository id. */
  repository: string;
  packageName: string;
  version?: string;
}

const REPOLOGY_REPOS: Record<
  string,
  { type: string; platform: string; label: string; url: (name: string) => string }
> = {
  homebrew: {
    type: 'package-manager',
    platform: 'macos',
    label: 'Homebrew',
    url: (n) => `https://formulae.brew.sh/formula/${n}`,
  },
  homebrew_casks: {
    type: 'package-manager',
    platform: 'macos',
    label: 'Homebrew Cask',
    url: (n) => `https://formulae.brew.sh/cask/${n}`,
  },
  aur: {
    type: 'package-manager',
    platform: 'linux',
    label: 'AUR',
    url: (n) => `https://aur.archlinux.org/packages/${n}`,
  },
  arch: {
    type: 'package-manager',
    platform: 'linux',
    label: 'Arch Linux',
    url: (n) => `https://archlinux.org/packages/?q=${n}`,
  },
  nix_unstable: {
    type: 'package-manager',
    platform: 'linux',
    label: 'Nixpkgs',
    url: (n) => `https://search.nixos.org/packages?channel=unstable&query=${n}`,
  },
  scoop: {
    type: 'package-manager',
    platform: 'windows',
    label: 'Scoop',
    url: (n) => `https://scoop.sh/#/apps?q=${n}`,
  },
  chocolatey: {
    type: 'package-manager',
    platform: 'windows',
    label: 'Chocolatey',
    url: (n) => `https://community.chocolatey.org/packages/${n}`,
  },
  winget: {
    type: 'package-manager',
    platform: 'windows',
    label: 'winget',
    url: (n) =>
      `https://github.com/microsoft/winget-pkgs/tree/master/manifests/${n.charAt(0).toLowerCase()}/${n.replace(/\./g, '/')}`,
  },
  snapcraft: {
    type: 'snapcraft',
    platform: 'linux',
    label: 'Snapcraft',
    url: (n) => `https://snapcraft.io/${n}`,
  },
  flathub: {
    type: 'flathub',
    platform: 'linux',
    label: 'Flathub',
    url: (n) => `https://flathub.org/apps/${n}`,
  },
  fdroid: {
    type: 'fdroid',
    platform: 'android',
    label: 'F-Droid',
    url: (n) => `https://f-droid.org/packages/${n}/`,
  },
};

/**
 * One channel per package repository Grove knows how to link to
 * (Homebrew, AUR, Nixpkgs, Scoop, winget, Chocolatey, Snapcraft,
 * Flathub, F-Droid); every other repository Repology tracks is left
 * out. Sorted by repository id.
 */
export function repologyChannels(packages: readonly RepologyPackage[]): RepologyChannel[] {
  const byRepo = new Map<string, RepologyChannel>();
  const sorted = [...packages].sort(
    (a, b) =>
      (a.repo ?? '').localeCompare(b.repo ?? '') ||
      (a.srcname ?? a.binname ?? '').localeCompare(b.srcname ?? b.binname ?? ''),
  );
  for (const pkg of sorted) {
    const repo = pkg.repo ?? '';
    const known = REPOLOGY_REPOS[repo];
    if (!known || byRepo.has(repo)) continue;
    // AUR, Arch and Nixpkgs are searched by binary name; the others by source name.
    const byBinary = repo === 'aur' || repo === 'arch' || repo === 'nix_unstable';
    const name = byBinary ? (pkg.binname ?? pkg.srcname) : (pkg.srcname ?? pkg.binname);
    if (!name || !/^[\w@.+-]+$/.test(name)) continue;
    byRepo.set(repo, {
      type: known.type,
      platform: known.platform,
      label: known.label,
      url: known.url(name),
      repository: repo,
      packageName: name,
      ...(pkg.version ? { version: pkg.version } : {}),
    });
  }
  return [...byRepo.values()];
}

/** Compare a release tag with a package version, ignoring a leading `v`. */
export function sameVersion(tag: string | undefined, version: string | undefined): boolean {
  if (!tag || !version) return false;
  const clean = (v: string) =>
    v
      .trim()
      .replace(/^v(?=\d)/i, '')
      .toLowerCase();
  return clean(tag) === clean(version) || clean(tag).endsWith(`-${clean(version)}`);
}
