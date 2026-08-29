/**
 * Per-page OG image generation — satori (layout → SVG) + resvg
 * (SVG → PNG), exactly as documented in `outputs/seo.md`.
 *
 * `buildOgImages` runs at the end of `prepareDirectory` and writes
 * 1200×630 PNGs under `public/og/`:
 *
 *   og/home.png                  — the home page
 *   og/default.png               — index/utility pages
 *   og/records/<slug>.png        — one per record
 *   og/collections/<slug>.png    — one per collection
 *   og/categories/<id>.png       — one per category
 *   og/stacks/<id>.png           — one per stack
 *   og/licenses/<id>.png         — one per license
 *
 * A content-hash manifest (`data/generated/og-manifest.json`) skips
 * images whose template input hasn't changed, so incremental builds
 * only pay for what moved. The whole pipeline is non-fatal: if the
 * native resvg binding is unavailable the build logs a warning and
 * pages fall back to the static `/og-image.svg`.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { hostOf } from './host.js';
import type { GroveConfig } from './schema.js';

export type OgTemplate =
  | {
      kind: 'home';
      siteName: string;
      tagline?: string;
      host: string;
      metric?: string;
      accent?: string;
    }
  | { kind: 'default'; siteName: string; tagline?: string; host: string; accent?: string }
  | {
      kind: 'record';
      siteName: string;
      name: string;
      descriptor?: string;
      stars?: number;
      category?: string;
      host: string;
      accent?: string;
    }
  | {
      kind: 'collection';
      siteName: string;
      title: string;
      count: number;
      noun: string;
      host: string;
      accent?: string;
    }
  | {
      kind: 'taxonomy';
      siteName: string;
      label: string;
      facet: 'category' | 'stack' | 'license';
      count: number;
      noun: string;
      host: string;
      accent?: string;
    };

const WIDTH = 1200;
const HEIGHT = 630;

// Satori element helper — React-less createElement.
type El = { type: string; props: Record<string, unknown> };
function el(type: string, style: Record<string, unknown>, children?: El[] | string): El {
  return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

const INK_100 = '#fafafa';
const INK_400 = '#a1a1aa';
const INK_300 = '#d4d4d8';

/** Scale a headline down as it gets longer so it never overflows. */
function headlineSize(text: string): number {
  if (text.length <= 18) return 84;
  if (text.length <= 30) return 68;
  if (text.length <= 45) return 54;
  return 44;
}

function layout(input: {
  eyebrow: string;
  headline: string;
  sub?: string;
  footerLeft: string;
  footerRight?: string;
  accent: string;
}): El {
  return el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 88px',
      backgroundImage: 'linear-gradient(135deg, #0a0a0c, #18181b)',
      fontFamily: 'Inter',
      position: 'relative',
    },
    [
      // Accent glow — echoes the static og-image.svg so per-page and
      // site-wide cards read as one family.
      el('div', {
        position: 'absolute',
        top: '-180px',
        right: '-120px',
        width: '520px',
        height: '520px',
        borderRadius: '9999px',
        backgroundColor: input.accent,
        opacity: 0.18,
      }),
      el('div', { display: 'flex', alignItems: 'center', gap: '16px' }, [
        el('div', {
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          backgroundColor: input.accent,
        }),
        el('div', { fontSize: '26px', color: INK_300, letterSpacing: '0.5px' }, input.eyebrow),
      ]),
      el('div', { display: 'flex', flexDirection: 'column', gap: '22px' }, [
        el(
          'div',
          {
            fontSize: `${headlineSize(input.headline)}px`,
            fontWeight: 600,
            color: INK_100,
            letterSpacing: '-2px',
            lineHeight: 1.08,
            maxWidth: '1000px',
          },
          input.headline,
        ),
        ...(input.sub
          ? [
              el(
                'div',
                {
                  fontSize: '30px',
                  color: INK_400,
                  lineHeight: 1.4,
                  maxWidth: '980px',
                },
                input.sub,
              ),
            ]
          : []),
      ]),
      el(
        'div',
        {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '22px',
        },
        [
          el('div', { color: INK_300 }, input.footerLeft),
          ...(input.footerRight ? [el('div', { color: input.accent }, input.footerRight)] : []),
        ],
      ),
    ],
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function templateToElement(t: OgTemplate): El {
  const accent = t.accent ?? '#e5e5e5';
  switch (t.kind) {
    case 'home':
    case 'default':
      return layout({
        eyebrow: t.host,
        headline: t.siteName,
        ...(t.tagline ? { sub: truncate(t.tagline, 120) } : {}),
        footerLeft: t.host,
        ...(t.kind === 'home' && t.metric ? { footerRight: t.metric } : {}),
        accent,
      });
    case 'record': {
      const stars =
        typeof t.stars === 'number' && t.stars > 0
          ? `★ ${t.stars.toLocaleString('en-US')}`
          : undefined;
      return layout({
        eyebrow: t.category ? `${t.siteName} · ${t.category}` : t.siteName,
        headline: truncate(t.name, 60),
        ...(t.descriptor ? { sub: truncate(t.descriptor, 120) } : {}),
        footerLeft: t.host,
        ...(stars ? { footerRight: stars } : {}),
        accent,
      });
    }
    case 'collection':
      return layout({
        eyebrow: `${t.siteName} · Collection`,
        headline: truncate(t.title, 70),
        sub: `${t.count} curated ${t.noun}`,
        footerLeft: t.host,
        accent,
      });
    case 'taxonomy': {
      const facetLabel =
        t.facet === 'category' ? 'Category' : t.facet === 'stack' ? 'Stack' : 'License';
      return layout({
        eyebrow: `${t.siteName} · ${facetLabel}`,
        headline: truncate(t.label, 60),
        sub: `${t.count} open-source ${t.noun}`,
        footerLeft: t.host,
        accent,
      });
    }
  }
}

let fontsPromise: Promise<
  Array<{ name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }>
> | null = null;
async function loadFonts() {
  fontsPromise ??= (async () => {
    const load = async (file: string) => {
      const url = new URL(`../assets/fonts/${file}`, import.meta.url);
      const buf = await readFile(url);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    };
    return [
      {
        name: 'Inter',
        data: await load('Inter-Regular.ttf'),
        weight: 400 as const,
        style: 'normal' as const,
      },
      {
        name: 'Inter',
        data: await load('Inter-SemiBold.ttf'),
        weight: 600 as const,
        style: 'normal' as const,
      },
    ];
  })();
  return fontsPromise;
}

// Dynamic, bundler-opaque imports: this code only ever runs inside
// `prepareDirectory` (plain Node at build time), but the module graph
// is also traversed by the consumer's Vite build via the core barrel.
// `@vite-ignore` keeps Vite/rolldown from trying to bundle resvg's
// native .node binary.
async function importRenderer() {
  const [satoriMod, resvgMod] = await Promise.all([
    import(/* @vite-ignore */ 'satori'),
    import(/* @vite-ignore */ '@resvg/resvg-js'),
  ]);
  return {
    satori: (satoriMod as { default: (element: unknown, options: unknown) => Promise<string> })
      .default,
    Resvg: (
      resvgMod as {
        Resvg: new (svg: string, options?: unknown) => { render(): { asPng(): Uint8Array } };
      }
    ).Resvg,
  };
}

/** Render one OG template to a 1200×630 PNG buffer. */
export async function renderOgPng(t: OgTemplate): Promise<Uint8Array> {
  const { satori, Resvg } = await importRenderer();
  const fonts = await loadFonts();
  const svg = await satori(templateToElement(t), {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  return resvg.render().asPng();
}

export interface OgBuildInput {
  records: Array<{
    slug: string;
    name: string;
    descriptor?: string;
    stars?: number;
    category?: string;
  }>;
  collections: Array<{ slug: string; title: string; count: number }>;
  taxonomies: Array<{
    facet: 'category' | 'stack' | 'license';
    id: string;
    label: string;
    count: number;
  }>;
  stats?: { totalRecords?: number; repositoryStars?: number };
  /** Item noun for captions (e.g. "projects"). Defaults to
   *  `config.labels.plural`, falling back to "items". */
  noun?: string;
}

export interface OgBuildResult {
  written: number;
  skipped: number;
  failed: boolean;
}

const FACET_DIR: Record<'category' | 'stack' | 'license', string> = {
  category: 'categories',
  stack: 'stacks',
  license: 'licenses',
};

/**
 * Generate every per-page OG PNG under `<publicDir>/og/`.
 *
 * Non-fatal by design: any error (most likely the native resvg
 * binding failing to load on an unusual platform) logs one warning
 * and returns `{failed: true}` — the site builds with the static
 * SVG fallback instead.
 */
export async function buildOgImages(
  cwd: string,
  config: GroveConfig,
  input: OgBuildInput,
): Promise<OgBuildResult> {
  const publicDir = resolve(cwd, config.paths.publicDir);
  const ogDir = join(publicDir, 'og');
  const manifestPath = resolve(cwd, config.paths.generatedDir, 'og-manifest.json');
  const accent = config.theme.primaryColor ?? '#e5e5e5';
  const host = hostOf(config.site.url);
  const siteName = config.site.name;
  const noun = input.noun ?? config.labels.plural ?? 'items';

  const count = input.stats?.totalRecords ?? input.records.length;
  const stars = input.stats?.repositoryStars ?? 0;
  const metric =
    stars > 0 ? `${count} ${noun} · ${stars.toLocaleString('en-US')} stars` : `${count} ${noun}`;

  const jobs: Array<{ rel: string; template: OgTemplate }> = [
    {
      rel: 'home.png',
      template: { kind: 'home', siteName, tagline: config.site.tagline, host, metric, accent },
    },
    {
      rel: 'default.png',
      template: { kind: 'default', siteName, tagline: config.site.tagline, host, accent },
    },
    ...input.records.map((r) => ({
      rel: `records/${r.slug}.png`,
      template: {
        kind: 'record' as const,
        siteName,
        name: r.name,
        ...(r.descriptor ? { descriptor: r.descriptor } : {}),
        ...(typeof r.stars === 'number' ? { stars: r.stars } : {}),
        ...(r.category ? { category: r.category } : {}),
        host,
        accent,
      },
    })),
    ...input.collections.map((c) => ({
      rel: `collections/${c.slug}.png`,
      template: {
        kind: 'collection' as const,
        siteName,
        title: c.title,
        count: c.count,
        noun,
        host,
        accent,
      },
    })),
    ...input.taxonomies.map((t) => ({
      rel: `${FACET_DIR[t.facet]}/${t.id}.png`,
      template: {
        kind: 'taxonomy' as const,
        siteName,
        label: t.label,
        facet: t.facet,
        count: t.count,
        noun,
        host,
        accent,
      },
    })),
  ];

  let manifest: Record<string, string> = {};
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, string>;
  } catch {
    // Missing/corrupt manifest — regenerate everything.
  }

  const nextManifest: Record<string, string> = {};
  let written = 0;
  let skipped = 0;
  try {
    // Bounded concurrency: satori+resvg is CPU-bound, ~30–60ms per
    // image; 8 at a time keeps a 500-record build in the tens of
    // seconds without saturating the machine.
    const CONCURRENCY = 8;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (job) => {
          const hash = createHash('sha1').update(JSON.stringify(job.template)).digest('hex');
          nextManifest[job.rel] = hash;
          const outPath = join(ogDir, job.rel);
          if (manifest[job.rel] === hash && existsSync(outPath)) {
            skipped += 1;
            return;
          }
          const png = await renderOgPng(job.template);
          await mkdir(dirname(outPath), { recursive: true });
          await writeFile(outPath, png);
          written += 1;
        }),
      );
    }
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    return { written, skipped, failed: false };
  } catch (error) {
    console.warn(
      `[grove] OG image generation failed (${(error as Error).message}); pages will fall back to /og-image.svg`,
    );
    return { written, skipped, failed: true };
  }
}
