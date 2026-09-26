/**
 * Outbound attribution.
 *
 * Links from a record page to the record's own site carry
 * `ref=<site host>` so the maintainer sees the directory in Plausible,
 * GA, Umami and the like — most of them read `ref` as the source when
 * the browser sends no referrer. Forges, app stores and package
 * registries are left alone: they ignore the parameter or treat the URL
 * as a different listing. Those still see the directory, because
 * outbound links use `rel="noopener"` and keep the referrer.
 */
import { hostOf } from './host.js';

export const DEFAULT_REF_SKIP_HOSTS: readonly string[] = [
  'github.com',
  'gitlab.com',
  'codeberg.org',
  'bitbucket.org',
  'sr.ht',
  'apps.apple.com',
  'itunes.apple.com',
  'testflight.apple.com',
  'play.google.com',
  'f-droid.org',
  'flathub.org',
  'snapcraft.io',
  'apps.microsoft.com',
  'microsoft.com',
  'npmjs.com',
  'pypi.org',
  'crates.io',
  'hub.docker.com',
  'addons.mozilla.org',
  'chromewebstore.google.com',
  'chrome.google.com',
];

export interface OutboundOptions {
  /** The `ref` value; `false` or empty leaves every URL unchanged. */
  ref?: string | false;
  /** Hosts to leave untouched on top of `DEFAULT_REF_SKIP_HOSTS`. */
  skipHosts?: readonly string[];
}

/** `outbound.ref` from the config, defaulting to the host of `site.url`. */
export function resolveOutboundRef(
  ref: string | false | undefined,
  siteUrl: string | undefined,
): string | false {
  if (ref === false) return false;
  if (ref) return ref;
  return siteUrl ? hostOf(siteUrl).replace(/^www\./, '') : false;
}

function skipped(host: string, extra: readonly string[]): boolean {
  const h = host.replace(/^www\./, '').toLowerCase();
  return [...DEFAULT_REF_SKIP_HOSTS, ...extra].some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * `url` with `ref` added, unless attribution is off, the host is
 * skipped, or the URL already names a `ref` / `utm_source`. Anything
 * that is not an http(s) URL comes back unchanged.
 */
export function withRef(url: string, options: OutboundOptions): string;
export function withRef(
  url: string | null | undefined,
  options: OutboundOptions,
): string | undefined;
export function withRef(
  url: string | null | undefined,
  options: OutboundOptions,
): string | undefined {
  if (!url) return url ?? undefined;
  if (!options.ref) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return url;
  if (skipped(parsed.hostname, options.skipHosts ?? [])) return url;
  if (parsed.searchParams.has('ref') || parsed.searchParams.has('utm_source')) return url;
  parsed.searchParams.set('ref', options.ref);
  return parsed.toString();
}
