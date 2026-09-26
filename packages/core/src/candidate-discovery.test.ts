import { describe, expect, it } from 'vitest';
import {
  findAssetLogos,
  findFastlane,
  findGradleAppFiles,
  findMetainfoFiles,
  findWebManifests,
  installableAssets,
  isExcludedPath,
  parseAppstream,
  parseGradleApplicationIds,
  pickManifestIcon,
  repologyChannels,
  sameVersion,
  type TreeFile,
} from './candidate-discovery.js';

const files = (...paths: string[]): TreeFile[] =>
  paths.map((path, i) => ({ path, sha: `sha${i}`, size: 1000 + i }));

describe('isExcludedPath', () => {
  it('skips dependency, docs, test and build directories', () => {
    expect(isExcludedPath('node_modules/pkg/icon.png')).toBe(true);
    expect(isExcludedPath('web/vendor/x/logo.svg')).toBe(true);
    expect(isExcludedPath('.github/assets/logo.png')).toBe(true);
    expect(isExcludedPath('docs/images/logo.png')).toBe(true);
    expect(isExcludedPath('assets/logo.png')).toBe(false);
  });
});

describe('findFastlane', () => {
  it('prefers en-US and the shallowest fastlane directory', () => {
    const found = findFastlane(
      files(
        'android/fastlane/metadata/android/en-US/images/icon.png',
        'fastlane/metadata/android/de-DE/images/icon.png',
        'fastlane/metadata/android/en-US/images/icon.png',
        'fastlane/metadata/android/en-US/images/phoneScreenshots/10.png',
        'fastlane/metadata/android/en-US/images/phoneScreenshots/2.png',
        'fastlane/metadata/android/en-US/images/featureGraphic.png',
        'fastlane/metadata/android/en-US/images/tvBanner.png',
      ),
    );
    expect(found?.root).toBe('');
    expect(found?.locale).toBe('en-US');
    expect(found?.icon?.path).toBe('fastlane/metadata/android/en-US/images/icon.png');
    // Natural order: 2 before 10; graphics and banners are not screenshots.
    expect(found?.screenshots.map((f) => f.path.split('/').pop())).toEqual(['2.png', '10.png']);
  });

  it('falls back to the first locale that has content', () => {
    const found = findFastlane(
      files('mobile/fastlane/metadata/android/fr-FR/images/phoneScreenshots/1.jpg'),
    );
    expect(found).toMatchObject({ root: 'mobile', locale: 'fr-FR' });
    expect(found?.icon).toBeUndefined();
  });

  it('returns undefined without fastlane metadata', () => {
    expect(findFastlane(files('android/app/src/main/res/mipmap/ic_launcher.png'))).toBeUndefined();
  });
});

describe('Gradle application ids', () => {
  it('reads the app module next to fastlane and skips root build files when an app module exists', () => {
    const picked = findGradleAppFiles(
      files(
        'android/build.gradle',
        'android/app/build.gradle.kts',
        'other/app/build.gradle',
        'node_modules/x/android/app/build.gradle',
      ),
      'android',
    );
    expect(picked.map((f) => f.path)).toEqual([
      'android/app/build.gradle.kts',
      'other/app/build.gradle',
    ]);
  });

  it('parses Groovy and Kotlin DSL ids, including flavors', () => {
    const text = [
      'defaultConfig {',
      '  applicationId "org.example.app"',
      '}',
      'productFlavors { fdroid { applicationId = "org.example.app.fdroid" } }',
      'applicationIdSuffix ".debug"',
    ].join('\n');
    expect(parseGradleApplicationIds(text)).toEqual(['org.example.app', 'org.example.app.fdroid']);
    expect(parseGradleApplicationIds('applicationId = flutter.applicationId')).toEqual([]);
  });
});

describe('AppStream', () => {
  it('finds metainfo files and parses id, remote icon and source screenshots', () => {
    expect(
      findMetainfoFiles(
        files(
          'linux/org.example.App.metainfo.xml',
          'deep/x/y/z.appdata.xml',
          'docs/a.metainfo.xml',
        ),
      ).map((f) => f.path),
    ).toEqual(['linux/org.example.App.metainfo.xml', 'deep/x/y/z.appdata.xml']);

    const xml = `<?xml version="1.0"?>
<component type="desktop-application">
  <!-- <id>commented.out</id> -->
  <id>org.example.App.desktop</id>
  <icon type="stock">org.example.App</icon>
  <icon type="remote" width="128" height="128">https://example.org/icon.png</icon>
  <screenshots>
    <screenshot type="default">
      <image type="thumbnail">https://example.org/thumb.png</image>
      <image type="source">https://example.org/shot1.png</image>
    </screenshot>
    <screenshot><image>https://example.org/shot2.png?a=1&amp;b=2</image></screenshot>
  </screenshots>
</component>`;
    expect(parseAppstream(xml)).toEqual({
      id: 'org.example.App',
      icons: ['https://example.org/icon.png'],
      screenshots: ['https://example.org/shot1.png', 'https://example.org/shot2.png?a=1&b=2'],
    });
  });

  it('falls back to the file name for the id', () => {
    expect(parseAppstream('<component/>', 'flatpak/com.x.Y.metainfo.xml').id).toBe('com.x.Y');
  });
});

describe('web manifests', () => {
  it('only reads manifest.json under a web root', () => {
    expect(
      findWebManifests(
        files('public/manifest.json', 'extension/manifest.json', 'site.webmanifest'),
      ).map((f) => f.path),
    ).toEqual(['site.webmanifest', 'public/manifest.json']);
  });

  it('picks the largest non-maskable icon and resolves it against the web root', () => {
    const manifest = JSON.stringify({
      name: 'App',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192' },
        { src: '/icons/icon-512.png', sizes: '512x512' },
        { src: '/icons/maskable-1024.png', sizes: '1024x1024', purpose: 'maskable' },
        { src: 'windows11/SplashScreen.scale-400.png', sizes: '2480x1200' },
        { src: 'https://cdn.example.org/icon.png', sizes: '4096x4096' },
      ],
    });
    expect(pickManifestIcon(manifest, 'web/public/manifest.json')).toBe(
      'web/public/icons/icon-512.png',
    );
    expect(
      pickManifestIcon('{"manifest_version":3,"icons":[]}', 'public/manifest.json'),
    ).toBeUndefined();
    expect(pickManifestIcon('not json', 'public/manifest.json')).toBeUndefined();
  });
});

describe('findAssetLogos', () => {
  it('matches logo and icon files in asset directories, SVG first', () => {
    const picked = findAssetLogos(
      files(
        'assets/images/logo.png',
        'assets/logo.svg',
        'public/icon-512.png',
        'public/icon-32.png', // favicon-sized
        'assets/banner-logo.png', // banner
        'src/logo.png', // not an asset directory
        'public/og-image.png',
        'assets/icons/icon-close.svg', // UI icon, not a logo
        'node_modules/pkg/assets/logo.png',
        'assets/myapp-logo.png',
      ),
      'MyApp',
      10,
    );
    expect(picked.map((f) => f.path)).toEqual([
      'assets/logo.svg',
      'assets/myapp-logo.png',
      'public/icon-512.png',
      'assets/images/logo.png',
    ]);
  });

  it('drops a file name repeated across three or more packages', () => {
    const picked = findAssetLogos(
      files(
        'addons/a/resources/icon.png',
        'addons/b/resources/icon.png',
        'addons/c/resources/icon.png',
        'media/icon256x256.png',
      ),
      'kodi',
    );
    expect(picked.map((f) => f.path)).toEqual(['media/icon256x256.png']);
  });
});

describe('installableAssets', () => {
  it('groups installable release assets by platform', () => {
    const grouped = installableAssets([
      'app-arm64.apk',
      'app-debug.apk',
      'App.dmg',
      'App-Setup.exe',
      'App.exe.blockmap',
      'app.AppImage',
      'app_amd64.deb',
      'source.tar.gz',
      'checksums.txt',
    ]);
    expect(Object.fromEntries(grouped)).toEqual({
      android: ['app-arm64.apk'],
      macos: ['App.dmg'],
      windows: ['App-Setup.exe'],
      linux: ['app.AppImage', 'app_amd64.deb'],
    });
  });
});

describe('repologyChannels', () => {
  it('keeps one channel per known repository, sorted', () => {
    const channels = repologyChannels([
      {
        repo: 'nix_unstable',
        srcname: 'pkgs/by-name/ex/example/package.nix',
        binname: 'example',
        version: '1.2.0',
      },
      { repo: 'homebrew_casks', srcname: 'example', version: '1.2.0' },
      { repo: 'aur', srcname: 'example-bin', binname: 'example-bin', version: '1.2.0' },
      { repo: 'aur', srcname: 'example-git', binname: 'example-git', version: '1.2.0.r5' },
      { repo: 'debian_13', srcname: 'example', version: '1.0.0' },
    ]);
    expect(channels.map((c) => [c.repository, c.url])).toEqual([
      ['aur', 'https://aur.archlinux.org/packages/example-bin'],
      ['homebrew_casks', 'https://formulae.brew.sh/cask/example'],
      ['nix_unstable', 'https://search.nixos.org/packages?channel=unstable&query=example'],
    ]);
  });

  it('compares versions ignoring a leading v', () => {
    expect(sameVersion('v1.2.0', '1.2.0')).toBe(true);
    expect(sameVersion('desktop_v1.2.0', '1.2.0')).toBe(false);
    expect(sameVersion('1.2.0', '1.3.0')).toBe(false);
    expect(sameVersion(undefined, '1.2.0')).toBe(false);
  });
});
