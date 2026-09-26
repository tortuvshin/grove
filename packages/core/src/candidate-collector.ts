import {
  findAssetLogos,
  findFastlane,
  findGradleAppFiles,
  findMetainfoFiles,
  findWebManifests,
  installableAssets,
  parseAppstream,
  parseGradleApplicationIds,
  pickManifestIcon,
  type RepologyPackage,
  repologyChannels,
  sameVersion,
  type TreeFile,
} from './candidate-discovery.js';
import type {
  CandidateOrigin,
  ChannelCandidate,
  MediaCandidate,
  RecordCandidates,
} from './candidate-schema.js';
import { resolveGithubToken } from './github.js';
import { IMAGE_PROBE_BYTES, imageFormatFromPath, probeImageBytes } from './image-probe.js';
import { mergeRecordCandidates } from './record-candidates.js';

/**
 * Network side of `integrations.github.candidates`: for one record,
 * read the repository's file tree and latest release from GitHub, a
 * few small files from it, and ask F-Droid, Flathub and Repology
 * whether they carry the app. The result is review material for the
 * sync cache — never written into the record.
 *
 * Every request counts against a per-record budget. A host that keeps
 * failing, or answers 429, is skipped for the rest of the run.
 * Repology is asked at most once a second with an identifying
 * User-Agent, as its API rules require. Nothing here throws: failures
 * come back as strings for `partialFailures`.
 */

export const GITHUB_API = 'https://api.github.com';
export const RAW_GITHUB = 'https://raw.githubusercontent.com';
/** Serves Git LFS objects; a probe follows an LFS pointer here. */
export const MEDIA_GITHUB = 'https://media.githubusercontent.com/media';
export const FDROID_API = 'https://f-droid.org/api/v1/packages';
export const FLATHUB_API = 'https://flathub.org/api/v2';
export const REPOLOGY_API = 'https://repology.org/api/v1/project';

/** Requests one record may make while collecting candidates. */
export const CANDIDATE_REQUESTS_PER_RECORD = 24;

/** Repology asks API clients for no more than one request per second. */
export const REPOLOGY_MIN_INTERVAL_MS = 1_000;

/** Consecutive network errors or 5xx after which a host is skipped for the run. */
const HOST_ERROR_LIMIT = 2;

const MAX_LOGOS = 6;
const MAX_SCREENSHOTS = 8;
/** Screenshots whose size is probed; the rest carry type and bytes only. */
const PROBED_SCREENSHOTS = 3;
/** Raster logos smaller than this on both sides are toolbar icons, not logos. */
const MIN_RASTER_LOGO = 128;

const LFS_POINTER = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\b[\s\S]*?\bsize (\d+)/;

export interface CandidateCollectorOptions {
  /** GitHub token, sent to api.github.com only. Default: `GH_TOKEN` / `GITHUB_TOKEN`. */
  token?: string;
  /** Identifies the client to Repology and the other indexes. */
  userAgent?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Clock for the Repology interval. */
  clock?: () => number;
  now?: () => Date;
  timeoutMs?: number;
  requestsPerRecord?: number;
}

export interface CandidateCollectInput {
  owner: string;
  repo: string;
  /** Candidates from the previous cache entry: kept when unchanged or when their source fails. */
  previous?: RecordCandidates;
}

export interface CandidateCollection {
  candidates: RecordCandidates;
  /** One line per failed step, e.g. `repology: host unavailable`. */
  failures: string[];
  /** Requests this record made. */
  requests: number;
}

class SkipError extends Error {}

const DEFAULT_USER_AGENT = 'grove (+https://github.com/tortuvshin/grove)';

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function reasonOf(error: unknown): string {
  // undici reports "fetch failed" and keeps the useful part in `cause`.
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
  const base = error instanceof Error ? error.message : String(error);
  const text = cause?.code ? `${base} (${cause.code})` : base;
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Create a collector for one sync run. Host health and the Repology
 * clock are shared by every record in the run; the request budget is
 * per record.
 */
export function createCandidateCollector(options: CandidateCollectorOptions = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const clock = options.clock ?? Date.now;
  const now = options.now ?? (() => new Date());
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const perRecord = options.requestsPerRecord ?? CANDIDATE_REQUESTS_PER_RECORD;
  const token = options.token ?? resolveGithubToken();
  const hostErrors = new Map<string, number>();
  const disabledHosts = new Map<string, string>();
  let lastRepologyAt = Number.NEGATIVE_INFINITY;

  async function collect(input: CandidateCollectInput): Promise<CandidateCollection> {
    const { owner, repo } = input;
    const fetchedAt = now().toISOString();
    let requests = 0;
    const failures: string[] = [];
    const failedSources = new Set<CandidateOrigin>();
    const fail = (step: string, sources: CandidateOrigin[], error: unknown) => {
      failures.push(`${step}: ${reasonOf(error)}`);
      for (const source of sources) failedSources.add(source);
    };

    async function request(
      url: string,
      init: { headers?: Record<string, string>; method?: string; body?: string } = {},
    ): Promise<Response> {
      const host = new URL(url).host;
      const disabled = disabledHosts.get(host);
      if (disabled) throw new SkipError(`${host} skipped for this run (${disabled})`);
      if (requests >= perRecord) throw new SkipError(`request budget of ${perRecord} used up`);
      requests += 1;
      if (url.startsWith(REPOLOGY_API)) {
        const wait = lastRepologyAt + REPOLOGY_MIN_INTERVAL_MS - clock();
        if (wait > 0) await sleep(wait);
        lastRepologyAt = clock();
      }
      const headers: Record<string, string> = { 'User-Agent': userAgent, ...init.headers };
      if (url.startsWith(GITHUB_API)) {
        headers['X-GitHub-Api-Version'] = '2022-11-28';
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: init.method ?? 'GET',
          headers,
          ...(init.body ? { body: init.body } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const count = (hostErrors.get(host) ?? 0) + 1;
        hostErrors.set(host, count);
        if (count >= HOST_ERROR_LIMIT) {
          disabledHosts.set(host, `${count} network errors, last: ${reasonOf(error)}`);
        }
        throw error;
      }
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
      if (rateLimited) {
        disabledHosts.set(host, 'rate limited');
        throw new Error(`${host} rate limited (HTTP ${response.status})`);
      }
      if (response.status >= 500) {
        const count = (hostErrors.get(host) ?? 0) + 1;
        hostErrors.set(host, count);
        if (count >= HOST_ERROR_LIMIT) disabledHosts.set(host, `${count} server errors`);
        throw new Error(`${host} HTTP ${response.status}`);
      }
      hostErrors.set(host, 0);
      return response;
    }

    async function json(url: string, init?: Parameters<typeof request>[1]): Promise<unknown> {
      const response = await request(url, init);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${new URL(url).host}`);
      return response.json();
    }

    const apiBase = `${GITHUB_API}/repos/${owner}/${repo}`;
    const permalink = (commit: string, path: string) =>
      `https://github.com/${owner}/${repo}/blob/${commit}/${encodePath(path)}`;
    const rawUrl = (commit: string, path: string) =>
      `${RAW_GITHUB}/${owner}/${repo}/${commit}/${encodePath(path)}`;

    async function rawText(commit: string, path: string): Promise<string> {
      const response = await request(rawUrl(commit, path));
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      return response.text();
    }

    const channels: ChannelCandidate[] = [];
    const logos: MediaCandidate[] = [];
    const screenshots: MediaCandidate[] = [];

    // ── Repository tree ───────────────────────────────────────────
    const treeSources: CandidateOrigin[] = [
      'fastlane',
      'appstream',
      'web-manifest',
      'repo-asset',
      'fdroid',
    ];
    let commit: string | undefined;
    let files: TreeFile[] = [];
    try {
      const response = await request(`${apiBase}/commits/HEAD`, {
        headers: { Accept: 'application/vnd.github.sha' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} resolving HEAD`);
      commit = (await response.text()).trim();
      if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('HEAD did not resolve to a commit');
      const tree = (await json(`${apiBase}/git/trees/${commit}?recursive=1`, {
        headers: { Accept: 'application/vnd.github+json' },
      })) as { tree?: Array<Record<string, unknown>>; truncated?: boolean } | undefined;
      files = (tree?.tree ?? [])
        .filter((node) => node.type === 'blob' && typeof node.path === 'string')
        .map((node) => ({
          path: node.path as string,
          sha: String(node.sha ?? ''),
          ...(typeof node.size === 'number' ? { size: node.size } : {}),
        }));
      if (tree?.truncated) fail('tree', treeSources, 'GitHub truncated the file tree');
    } catch (error) {
      commit = undefined;
      fail('tree', treeSources, error);
    }
    const byPath = new Map(files.map((file) => [file.path, file]));

    const repoMedia = (
      file: TreeFile,
      source: CandidateOrigin,
      evidenceUrl?: string,
      extra: Partial<MediaCandidate> = {},
    ): MediaCandidate => {
      const format = imageFormatFromPath(file.path);
      const url = permalink(commit as string, file.path);
      return {
        url,
        path: file.path,
        blobSha: file.sha,
        ...extra,
        ...(format ? { format } : {}),
        ...(file.size !== undefined ? { bytes: file.size } : {}),
        provenance: { source, url: evidenceUrl ?? url, fetchedAt },
      };
    };

    // ── Latest release ────────────────────────────────────────────
    let releaseTag: string | undefined;
    try {
      const release = (await json(`${apiBase}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      })) as
        | { tag_name?: string; html_url?: string; assets?: Array<{ name?: string }> }
        | undefined;
      if (release) {
        releaseTag = release.tag_name;
        const names = (release.assets ?? []).map((a) => a.name).filter((n): n is string => !!n);
        for (const [platform, assets] of installableAssets(names)) {
          channels.push({
            type: 'github-releases',
            platform,
            label: 'GitHub Releases',
            url: `https://github.com/${owner}/${repo}/releases/latest`,
            facts: { ...(releaseTag ? { tag: releaseTag } : {}), assets: assets.slice(0, 6) },
            provenance: {
              source: 'github-releases',
              url: release.html_url ?? `https://github.com/${owner}/${repo}/releases/latest`,
              fetchedAt,
            },
          });
        }
      }
    } catch (error) {
      fail('releases', ['github-releases'], error);
    }

    // ── fastlane: icon, screenshots, and the Android app id ────────
    const fastlane = commit ? findFastlane(files, MAX_SCREENSHOTS) : undefined;
    if (fastlane?.icon)
      logos.push(repoMedia(fastlane.icon, 'fastlane', undefined, { locale: fastlane.locale }));
    for (const shot of fastlane?.screenshots ?? []) {
      screenshots.push(repoMedia(shot, 'fastlane', undefined, { locale: fastlane?.locale ?? '' }));
    }

    if (commit) {
      const appIds: Array<{ id: string; evidence: string }> = [];
      try {
        for (const file of findGradleAppFiles(files, fastlane?.root)) {
          for (const id of parseGradleApplicationIds(await rawText(commit, file.path))) {
            if (!appIds.some((a) => a.id === id))
              appIds.push({ id, evidence: permalink(commit, file.path) });
          }
        }
      } catch (error) {
        fail('gradle', ['fdroid'], error);
      }
      for (const { id, evidence } of appIds.slice(0, 3)) {
        try {
          const api = `${FDROID_API}/${encodeURIComponent(id)}`;
          const pkg = (await json(api)) as
            | { packageName?: string; suggestedVersionCode?: number }
            | undefined;
          if (!pkg?.packageName) continue;
          channels.push({
            type: 'fdroid',
            platform: 'android',
            label: 'F-Droid',
            url: `https://f-droid.org/packages/${pkg.packageName}/`,
            facts: {
              appId: pkg.packageName,
              ...(pkg.suggestedVersionCode
                ? { suggestedVersionCode: pkg.suggestedVersionCode }
                : {}),
              evidence,
              ...(fastlane
                ? {
                    fastlane: `${fastlane.root ? `${fastlane.root}/` : ''}fastlane/metadata/android`,
                  }
                : {}),
            },
            provenance: { source: 'fdroid', url: api, fetchedAt },
          });
        } catch (error) {
          fail('fdroid', ['fdroid'], error);
          break;
        }
      }
    }

    // ── AppStream: Flathub id, icon, screenshots ──────────────────
    const flathubIds = new Map<string, string>();
    if (commit) {
      for (const file of findMetainfoFiles(files)) {
        try {
          const facts = parseAppstream(await rawText(commit, file.path), file.path);
          const evidence = permalink(commit, file.path);
          if (facts.id && !flathubIds.has(facts.id)) flathubIds.set(facts.id, evidence);
          for (const url of facts.icons.slice(0, 2)) {
            logos.push(appstreamMedia(url, evidence));
          }
          for (const url of facts.screenshots.slice(0, MAX_SCREENSHOTS)) {
            screenshots.push(appstreamMedia(url, evidence));
          }
        } catch (error) {
          fail('appstream', ['appstream', 'flathub'], error);
        }
      }
    }

    function ownRepoPath(url: string): TreeFile | undefined {
      const prefixes = [
        `${RAW_GITHUB}/${owner}/${repo}/`,
        `https://github.com/${owner}/${repo}/raw/`,
        `https://github.com/${owner}/${repo}/blob/`,
      ].map((p) => p.toLowerCase());
      const prefix = prefixes.find((p) => url.toLowerCase().startsWith(p));
      if (!prefix) return undefined;
      const rest = url.slice(prefix.length).split(/[?#]/)[0] ?? '';
      const afterRef = rest
        .replace(/^refs\/(?:heads|tags)\//, '')
        .split('/')
        .slice(1)
        .join('/');
      try {
        return byPath.get(decodeURIComponent(afterRef));
      } catch {
        return undefined;
      }
    }

    function appstreamMedia(url: string, evidence: string): MediaCandidate {
      // A raw URL into this repository is the same file as a tree
      // entry: pin it to the commit like one.
      const file = ownRepoPath(url);
      if (file && commit) return repoMedia(file, 'appstream', evidence);
      const format = imageFormatFromPath(url);
      return {
        url,
        ...(format ? { format } : {}),
        provenance: { source: 'appstream', url: evidence, fetchedAt },
      };
    }

    const repoUrl = `https://github.com/${owner}/${repo}`.toLowerCase();
    const pointsAtRepo = (urls: Record<string, unknown> | undefined) =>
      Object.values(urls ?? {}).some(
        (u) => typeof u === 'string' && u.toLowerCase().replace(/(\.git)?\/*$/, '') === repoUrl,
      );

    async function flathubApp(id: string) {
      const api = `${FLATHUB_API}/appstream/${encodeURIComponent(id)}`;
      const app = (await json(api)) as { id?: string; urls?: Record<string, unknown> } | undefined;
      return app ? { api, app } : undefined;
    }

    try {
      for (const [id, evidence] of [...flathubIds].slice(0, 2)) {
        const found = await flathubApp(id);
        if (!found) continue;
        channels.push({
          type: 'flathub',
          platform: 'linux',
          label: 'Flathub',
          url: `https://flathub.org/apps/${id}`,
          facts: { appId: id, match: 'metainfo', evidence },
          provenance: { source: 'flathub', url: found.api, fetchedAt },
        });
      }
      if (!channels.some((c) => c.type === 'flathub')) {
        // No metainfo in the repository: most Flathub manifests live in
        // flathub/<app-id>. Search by name and keep only an app whose
        // AppStream URLs point back at this repository.
        const search = (await json(`${FLATHUB_API}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: repo }),
        })) as { hits?: Array<{ app_id?: string; name?: string }> } | undefined;
        const wanted = repo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const hits = (search?.hits ?? [])
          .filter((hit) => {
            const last = (hit.app_id ?? '')
              .split('.')
              .pop()
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            const name = (hit.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return hit.app_id && (last === wanted || name === wanted);
          })
          .slice(0, 2);
        for (const hit of hits) {
          const found = await flathubApp(hit.app_id as string);
          if (!found || !pointsAtRepo(found.app.urls)) continue;
          channels.push({
            type: 'flathub',
            platform: 'linux',
            label: 'Flathub',
            url: `https://flathub.org/apps/${hit.app_id}`,
            facts: { appId: hit.app_id, match: 'appstream-urls' },
            provenance: { source: 'flathub', url: found.api, fetchedAt },
          });
          break;
        }
      }
    } catch (error) {
      fail('flathub', ['flathub'], error);
    }

    // ── Repology ──────────────────────────────────────────────────
    try {
      const project = repo.toLowerCase();
      const api = `${REPOLOGY_API}/${encodeURIComponent(project)}`;
      const packages = ((await json(api, { headers: { Accept: 'application/json' } })) ??
        []) as RepologyPackage[];
      const known = new Set(channels.map((c) => `${c.type}\u0000${c.url}`));
      for (const channel of repologyChannels(Array.isArray(packages) ? packages : [])) {
        if (known.has(`${channel.type}\u0000${channel.url}`)) continue;
        channels.push({
          type: channel.type,
          platform: channel.platform,
          label: channel.label,
          url: channel.url,
          facts: {
            repository: channel.repository,
            package: channel.packageName,
            ...(channel.version ? { version: channel.version } : {}),
            project,
            // Repology projects are matched by name only; a version
            // equal to the latest release tag makes a mix-up unlikely.
            match: 'project-name',
            versionMatchesRelease: sameVersion(releaseTag, channel.version),
          },
          provenance: {
            source: 'repology',
            url: `https://repology.org/project/${project}/versions`,
            fetchedAt,
          },
        });
      }
    } catch (error) {
      fail('repology', ['repology'], error);
    }

    // ── Web manifest and asset logos ──────────────────────────────
    if (commit) {
      for (const manifest of findWebManifests(files)) {
        try {
          const iconPath = pickManifestIcon(await rawText(commit, manifest.path), manifest.path);
          const icon = iconPath ? byPath.get(iconPath) : undefined;
          if (icon) logos.push(repoMedia(icon, 'web-manifest', permalink(commit, manifest.path)));
        } catch (error) {
          fail('web-manifest', ['web-manifest'], error);
        }
      }
      for (const file of findAssetLogos(files, repo)) logos.push(repoMedia(file, 'repo-asset'));
    }

    // One candidate per file: the most trustworthy source wins.
    const uniqueLogos = mergeRecordCandidates(undefined, {
      channels: [],
      logos: dedupeByUrl(logos),
      screenshots: [],
    }).logos.slice(0, MAX_LOGOS);
    const uniqueShots = dedupeByUrl(screenshots).slice(0, MAX_SCREENSHOTS);

    // ── Dimensions: a small range read per image in the repository ─
    const previousMedia = new Map<string, MediaCandidate>();
    for (const media of [
      ...(input.previous?.logos ?? []),
      ...(input.previous?.screenshots ?? []),
    ]) {
      if (media.path && media.blobSha)
        previousMedia.set(`${media.path}\u0000${media.blobSha}`, media);
    }
    const probe = async (media: MediaCandidate) => {
      if (!media.path || !commit) return media;
      const known = previousMedia.get(`${media.path}\u0000${media.blobSha}`);
      if (known?.width && known.height) {
        return {
          ...media,
          ...(known.format ? { format: known.format } : {}),
          ...(known.bytes !== undefined ? { bytes: known.bytes } : {}),
          width: known.width,
          height: known.height,
        };
      }
      try {
        const range = { headers: { Range: `bytes=0-${IMAGE_PROBE_BYTES - 1}` } };
        let response = await request(rawUrl(commit, media.path), range);
        if (!response.ok) return media;
        let bytes = new Uint8Array(await response.arrayBuffer());
        let size = media.bytes;
        // Git LFS: the tree holds a pointer; the image is on the media host.
        const lfs = LFS_POINTER.exec(new TextDecoder().decode(bytes.subarray(0, 200)));
        if (lfs) {
          size = Number(lfs[1]);
          response = await request(
            `${MEDIA_GITHUB}/${owner}/${repo}/${commit}/${encodePath(media.path)}`,
            range,
          );
          if (!response.ok) return { ...media, bytes: size };
          bytes = new Uint8Array(await response.arrayBuffer());
        }
        const facts = probeImageBytes(bytes);
        return {
          ...media,
          ...(facts.format ? { format: facts.format } : {}),
          ...(size !== undefined ? { bytes: size } : {}),
          ...(facts.width ? { width: facts.width } : {}),
          ...(facts.height ? { height: facts.height } : {}),
        };
      } catch (error) {
        if (!(error instanceof SkipError)) failures.push(`probe: ${reasonOf(error)}`);
        return media;
      }
    };
    const probedLogos: MediaCandidate[] = [];
    for (const logo of uniqueLogos) {
      const probed = await probe(logo);
      const tiny =
        probed.provenance.source === 'repo-asset' &&
        probed.format !== 'svg' &&
        probed.width !== undefined &&
        probed.height !== undefined &&
        Math.max(probed.width, probed.height) < MIN_RASTER_LOGO;
      if (!tiny) probedLogos.push(probed);
    }
    const probedShots: MediaCandidate[] = [];
    for (const [i, shot] of uniqueShots.entries()) {
      probedShots.push(i < PROBED_SCREENSHOTS ? await probe(shot) : shot);
    }

    const candidates = mergeRecordCandidates(
      input.previous,
      { channels, logos: probedLogos, screenshots: probedShots },
      failedSources,
    );
    return { candidates, failures: [...new Set(failures)], requests };
  }

  return { collect };
}

/** One candidate per file: same path, same URL or same blob (a copy of the file elsewhere). */
function dedupeByUrl(list: readonly MediaCandidate[]): MediaCandidate[] {
  const seen = new Set<string>();
  const out: MediaCandidate[] = [];
  for (const media of list) {
    const keys = [media.path ?? media.url, ...(media.blobSha ? [`blob:${media.blobSha}`] : [])];
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    out.push(media);
  }
  return out;
}

export type CandidateCollector = ReturnType<typeof createCandidateCollector>;
