/**
 *  Source of truth: `data/generated/records.{full,index,json}` and
 *  `data/generated/site-config.json`, produced at build time by
 *  automatically from `data/records/*.yml` and `grove.config.ts`.
 *
 *  Three flavors of records are written by the generator:
 *
 *    - `records.full.json`   — every record, all visibility. Carries
 *      every normalized field (including `content`, `bestFor`,
 *      `whyListed`, `caveats`, full `github.repository`, ...).
 *      Use this for the detail page.
 *    - `records.index.json`  — slim projection, visible-only. Use
 *      this for the list page and any home-page sectioning. Shape
 *      is the `IndexRecord` discriminated union from `@grove-dev/core`.
 *    - `records.json`        — alias of `records.full.json`.
 *
 *  The YML files are the human-edited source; this module is a
 *  typed re-export so pages can import the records without parsing
 *  JSON inline.
 *
 *  Blueprint-aware helpers (`indexSlug`, `itemLabel`, `itemsByKind`,
 *  `items` default export) read from `data/generated/site-config.json`'s
 *  `blueprintConfig` block, so the same module works for all three
 *  blueprints — `project-directory` (default), `resource-hub`, and
 *  `ecosystem-map` — without per-blueprint forks.
 *
 *  JSON imports are static at the top of this module so Vite
 *  resolves them at build time. A fresh scaffold that has not yet
 *  complete preparation will fail the build with a clear Vite
 *  resolution error, which is the correct signal — a build that
 *  silently renders an empty directory hides real config mistakes.
 */
import fullPayload from '@grove/generated/records.full.json';
import indexPayload from '@grove/generated/records.index.json';
import siteConfigPayload from '@grove/generated/site-config.json';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { getSingletonHighlighter } from 'shiki';
import { prettySlug } from '../lib/display.js';
import { headingSlug, readContentFile, stripFrontmatter, uniqueSlug } from '@grove-dev/core';
import type {
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  Resource,
  IndexRecord,
  IndexProjectRecord,
  IndexResourceRecord,
  IndexEntityRecord,
} from '@grove-dev/core';

interface FullPayload {
  schemaVersion?: number;
  blueprint?: string;
  generatedAt?: string;
  totalRecords?: number;
  visibleRecords?: number;
  records?: Resource[];
}

interface IndexPayload {
  schemaVersion?: number;
  blueprint?: string;
  generatedAt?: string;
  totalRecords?: number;
  records?: IndexRecord[];
}

interface SiteConfigPayload {
  blueprint?: string;
  blueprintConfig?: {
    id?: string;
    kind?: 'project' | 'resource' | 'entity';
    routeSlug?: string;
    itemSlug?: string;
    /** V1 canonical field name for the record detail slug
     * (replaces the V0 `itemSlug` field). */
    recordSlug?: string;
    labelSingular?: string;
    labelPlural?: string;
  };
  taxonomy?: Partial<
    Record<
      'categories' | 'stacks' | 'platforms' | 'distributionChannels',
      Array<{ id: string; name: string }>
    >
  >;
  name?: string;
}

const fullRecordsRaw: Resource[] = (fullPayload as unknown as FullPayload).records ?? [];
const indexRecordsRaw: IndexRecord[] = (indexPayload as unknown as IndexPayload).records ?? [];
const siteConfigRaw: SiteConfigPayload = siteConfigPayload as SiteConfigPayload;
const taxonomyMaps = Object.fromEntries(
  Object.entries(siteConfigRaw.taxonomy ?? {}).map(([kind, entries]) => [
    kind,
    new Map((entries ?? []).map((entry) => [entry.id, entry.name])),
  ]),
) as Partial<
  Record<'categories' | 'stacks' | 'platforms' | 'distributionChannels', Map<string, string>>
>;
export const taxonomy = siteConfigRaw.taxonomy ?? {};

export function taxonomyLabel(
  kind: 'categories' | 'stacks' | 'platforms' | 'distributionChannels',
  id: string,
): string {
  return taxonomyMaps[kind]?.get(id) ?? prettySlug(id);
}

/** Full records (every record, all visibility). Use this for the
 *  detail page (where you need `content`, `bestFor`, `whyListed`,
 *  `caveats`, the full `github.repository` block, ...) and for
 *  the V0-published alias page at `/apps/[recordSlug]` that
 *  enumerates all records for `getStaticPaths`. */
export const fullRecords: Resource[] = fullRecordsRaw;

/** Index-payload records (visible-only slim shape). */
export const records: IndexRecord[] = indexRecordsRaw;

/** Resource-kind records — slim shape. */
/** Project-kind records — slim shape, ready for list pages. */
export const projects = records.filter((r): r is IndexProjectRecord => r.kind === 'project');

export const resources = records.filter((r): r is IndexResourceRecord => r.kind === 'resource');

/** Entity-kind records — slim shape. */
export const entities = records.filter((r): r is IndexEntityRecord => r.kind === 'entity');

const bySlug = new Map(fullRecords.map((r) => [r.slug, r]));

export function recordBySlug(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

/**
 *  Generic slug lookup. The spec name is `findRecord`; this is an
 *  alias of `recordBySlug` so consumers can use either spelling.
 */
export function findRecord(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

export function projectBySlug(slug: string): ProjectRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === 'project' ? r : undefined;
}

export function resourceBySlug(slug: string): ResourceRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === 'resource' ? r : undefined;
}

export function entityBySlug(slug: string): EntityRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === 'entity' ? r : undefined;
}

// ──────────────────────────────────────────────────────────────────────
// Blueprint-aware generic helpers
// ──────────────────────────────────────────────────────────────────────
//
// Every page (home, list, detail, submit) needs to know the
// route slug, the kind filter, and the human label. Rather than
// hardcode "project" / "projects" / "kind: project" at every
// call-site, we derive them once from `site-config.json`'s
// `blueprintConfig` block (populated by Grove preparation).
//
// `indexSlug()` and `itemLabel()` retain their old signatures
// (zero-arg) so existing pages keep working — they now read from
// the JSON instead of a switch statement.

const blueprintConfig = siteConfigRaw.blueprintConfig ?? {};
const blueprintKind = (blueprintConfig.kind ?? 'project') as 'project' | 'resource' | 'entity';
const blueprintId = (blueprintConfig.id ?? 'project-directory') as
  | 'project-directory'
  | 'resource-hub'
  | 'ecosystem-map';

/**
 * URL slug for the directory index page (e.g. `/projects/`,
 * `/resources/`, `/entities/`). Override in `grove.config.ts`
 * via `routes.directory` — reflected through to here at generate
 * time.
 */
export function indexSlug(): string {
  return blueprintConfig.routeSlug ?? 'projects';
}

/** URL slug for a single record detail page (the dynamic
 * `[recordSlug]` segment). Default "project" for backwards-compat
 * with V0-published configs that exposed the field as `itemSlug`. */
export function recordSlugConfig(): string {
  return blueprintConfig.recordSlug ?? blueprintConfig.itemSlug ?? 'project';
}

/** Singular human label, e.g. "project", "resource", "entity". */
export function itemLabel(): string {
  return blueprintConfig.labelSingular ?? 'project';
}

/** Plural human label, e.g. "projects", "resources", "entities". */
export function itemLabelPlural(): string {
  return blueprintConfig.labelPlural ?? 'projects';
}

/** Active blueprint id. */
export function blueprintIdFn(): string {
  return blueprintId;
}

/** Active record kind discriminator. */
export function activeKind(): 'project' | 'resource' | 'entity' {
  return blueprintKind;
}

/**
 * Generic items alias. Defaults to the kind this blueprint
 * produces (project/resource/entity). Use this for all
 * "list"-flavoured pages so a single template works for every
 * blueprint.
 */
export const items: IndexRecord[] = (() => {
  switch (blueprintKind) {
    case 'resource':
      return resources;
    case 'entity':
      return entities;
    case 'project':
    default:
      return projects;
  }
})();

/** Generic full-record alias. */
export const fullItems: Resource[] = (() => {
  return fullRecords.filter((r) => r.kind === blueprintKind);
})();

export const fullProjects: ProjectRecord[] = fullRecords.filter(
  (record): record is ProjectRecord => record.kind === 'project',
);

// ──────────────────────────────────────────────────────────────────────
// Markdown content rendering (sanitized)
// ──────────────────────────────────────────────────────────────────────
//
// `record.content` is a path to a markdown file under
// `content/records/<slug>.md` (see the project schema in
// @grove-dev/core). The previous page-level implementation
// imported `node:fs`, called `marked.parse` on the result, and
// inlined the raw HTML through `set:html` — a live XSS footgun
// the moment a record body is added. This module owns the read
// + render + sanitize pipeline at build time:
//
//   1. Resolve the path relative to this module's URL (or
//      `process.cwd` for tool-driven runs).
//   2. Read the file (gracefully absent → `null`).
//   3. `marked.parse` to HTML.
//   4. `sanitize-html` with a conservative allowlist that
//      matches the elements the `grove-prose` CSS actually
//      styles (h1-h4, p, ul/ol/li, pre/code, blockquote, a).
//      Links are restricted to safe schemes and external links
//      are hardened to `rel="noopener noreferrer" target="_blank"`.
//      javascript: / data: URIs are blocked; event handlers,
//      iframes, and scripts are stripped.
//
// The result is computed once at module load (per record) and
// memoized in `contentHtmlBySlug`. Pages call
// `getContentHtml(recordSlug)` to receive the sanitized HTML or
// `null` if the record has no `content` field / the file is
// missing. No page module needs to import `node:fs` anymore.

const here = dirname(fileURLToPath(import.meta.url));

// ── Markdown rendering ────────────────────────────────────────────────
//
// Record bodies and consumer-authored pages both go through the
// same pipeline:
//
//   body  →  marked.parse(body)  →  sanitizeHtml(html, allowlist)
//
// The differences are:
//   - record bodies use the wide `RECORD_BODY_ALLOWLIST` (tables,
//     images, task-list inputs, details/summary, kbd/mark/sub/sup,
//     …) so a curated `.md` sidecar can use the full surface.
//   - page bodies use the narrower `PAGE_BODY_ALLOWLIST` so a
//     page-author's `.md` stays in a conservative prose-only space.
//
// Both paths run at module load so `getContentHtml(slug)` and
// `getPageContentHtml(name)` return pre-sanitized HTML with no
// per-request work.

/** Wide allowlist used for `ProjectRecord.content` Markdown bodies. */
const RECORD_BODY_ALLOWLIST = [
  // Headings — full depth.
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  // Block-level content.
  'p',
  'br',
  'hr',
  'div',
  'blockquote',
  // Lists.
  'ul',
  'ol',
  'li',
  // Definition lists.
  'dl',
  'dt',
  'dd',
  // Tables (GFM).
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  // Inline formatting.
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'kbd',
  'abbr',
  // `<span>` is only here for Shiki's per-token wrappers inside
  // highlighted code blocks. Sanitize-html's default is to strip
  // any tag not in this list, so without `span` here the syntax
  // highlights silently disappear from fenced code.
  'span',
  // Links + images.
  'a',
  'img',
  // Code.
  'code',
  'pre',
  // Forms (task-list checkboxes only).
  'input',
  'label',
  // Collapsibles and semantic blocks.
  'details',
  'summary',
  'figure',
  'figcaption',
  'time',
];

/** Narrow allowlist used for `content/pages/<page>.md`. */
const PAGE_BODY_ALLOWLIST = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'del',
  'a',
  'code',
  'pre',
  'blockquote',
  'img',
];

/**
 * Attributes the sanitizer keeps per tag. The shared `* → ["id", "class"]`
 * rule preserves the heading anchors the renderer adds and the
 * Shiki syntax-highlighting classes (`shiki`, `language-bash`,
 * …) on `<pre>` and `<code>` blocks. Image `loading/decoding`
 * get forced to lazy/async to keep page weight down; `<input>`
 * becomes a hardened disabled checkbox for GFM task lists.
 */
const COMMON_BODY_ATTRIBUTES = {
  a: ['href', 'title', 'rel', 'target'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  th: ['scope', 'colspan', 'rowspan', 'align'],
  td: ['colspan', 'rowspan', 'align'],
  col: ['span', 'align'],
  input: ['type', 'checked', 'disabled'],
  label: ['for'],
  abbr: ['title'],
  time: ['datetime'],
  details: ['open'],
  div: ['class'], // table-wrap div the renderer injects
  span: ['style'], // Shiki emits inline `--shiki-light` / `--shiki-dark` CSS variables
  pre: ['class', 'style'], // Shiki also tags the outer `<pre>` with theme classes
  code: ['class'],
  '*': ['id'],
};

/**
 * CSS *value* patterns allowed per property in markdown authors' inline
 * `style="…"` attributes. Without this filter, sanitize-html leaves
 * the entire `style` string in place, which means a markdown author
 * could smuggle CSS expressions (e.g. `background:url(javascript:…)`)
 * into the rendered output even though no `<script>` tag is allowed.
 *
 * The regex is tested against the *value* part of each CSS declaration
 * (`prop:value` → value), per sanitize-html's `allowedStyles` contract
 * (it uses a CSS parser and matches `regularExpression.test(value)`).
 *
 * Allowed surface:
 *   - `--shiki-*` custom properties accept any value (Shiki's
 *     `--shiki-light` / `--shiki-dark` carry the per-token colors).
 *   - `color:` / `background-color:` accept only safe color values:
 *     hex (#rgb / #rrggbb / #rrggbbaa), rgb() / rgba(), hsl() / hsla().
 *
 * Anything else (positioning, layout, animation, expression(), url(),
 * …) is stripped by sanitize-html because no pattern matches.
 */
const SHIKI_VALUE = /.+/;
const COLOR_VALUE = /^(?:#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;

/** `<a>` tag normalization — open in a new tab, no opener. */
const ANCHOR_TRANSFORM = sanitizeHtml.simpleTransform(
  'a',
  { rel: 'noopener noreferrer', target: '_blank' },
  true,
);

/** Hardens `<img>` to lazy-load + async-decode. */
const IMG_TRANSFORM = (tagName: string, attribs: Record<string, string>) => ({
  tagName,
  attribs: {
    ...attribs,
    loading: attribs.loading ?? 'lazy',
    decoding: attribs.decoding ?? 'async',
  },
});

/** Forces `<input type="checkbox">` to be disabled so task lists
 *  render read-only at runtime (no on-page state to persist). */
const INPUT_TRANSFORM = (tagName: string, attribs: Record<string, string>) => ({
  tagName,
  attribs: {
    ...attribs,
    type: 'checkbox',
    disabled: '',
    ...(attribs.checked !== undefined ? { checked: '' } : {}),
  },
});

/**
 * Render a Markdown string to sanitized HTML. The renderer is
 * configured once (heading IDs + table wrap) and reused for both
 * record and page bodies.
 *
 * Why pass `body` rather than a slug: this is a pure transform; the
 * caller owns where the body came from (file, in-memory cache, …).
 * `getContentHtml(slug)` is the per-record wrapper that reads the
 * file and calls this.
 *
 * The heading-ID counter is allocated per call (not module-level) so
 * concurrent renders — or any future worker-thread path — can never
 * observe each other's counters.
 */
export function renderMarkdownToSafeHtml(
  body: string,
  options: { allowlist?: string[] } = {},
): string {
  const allowlist = options.allowlist ?? RECORD_BODY_ALLOWLIST;
  // Reset the heading-ID collision counter for this body so IDs are
  // stable per render and never leak between records.
  headingIds.clear();
  const rawHtml = marked.parse(body, { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: allowlist,
    allowedAttributes: COMMON_BODY_ATTRIBUTES,
    // `allowedStyles` is required because the `span` and `pre` tags
    // accept `style` (for Shiki's CSS variables) — without it
    // sanitize-html would pass any `style` content through, including
    // CSS expressions and `url(javascript:…)` payloads.
    allowedStyles: {
      '*': {
        // All `--shiki-*` custom properties (Shiki's CSS-variable
        // output for code-block tokenization).
        '--shiki-light': [SHIKI_VALUE],
        '--shiki-dark': [SHIKI_VALUE],
        // Hex / rgb() / rgba() / hsl() / hsla() colors only.
        color: [COLOR_VALUE],
        'background-color': [COLOR_VALUE],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel'],
      img: ['http', 'https', 'data'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    transformTags: {
      a: ANCHOR_TRANSFORM,
      img: IMG_TRANSFORM,
      input: INPUT_TRANSFORM,
    },
    disallowedTagsMode: 'discard',
  });
}

// ── marked configuration (hoisted, runs once at module load) ────────
//
// `marked.use({...})` registers a renderer that:
//   1. Adds a stable `id` to every h2–h6 so the TOC sidebar can
//      deep-link into the rendered body.
//   2. Wraps GFM tables in `<div class="grove-prose-table-wrap">`
//      so the column-width overflow is contained inside a rounded
//      border instead of breaking the layout.
//   3. Routes fenced code blocks through Shiki (see below).
//
// Heading-ID collision counter is allocated *per render* below and
// reset before each `marked.parse(...)` call so concurrent renders
// can never observe each other's counters in the same module instance.
marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      const inline = this.parser.parseInline(tokens);
      const plain = tokens
        .map((t: { text?: string; raw?: string }) => t.text ?? t.raw ?? '')
        .join('');
      const id =
        depth === 1 ? '' : ` id="${uniqueSlug(headingSlug(plain) || 'section', headingIds)}"`;
      return `<h${depth}${id}>${inline}</h${depth}>\n`;
    },
    table(token: {
      header: Array<{ tokens: unknown[] }>;
      rows: Array<Array<{ tokens: unknown[] }>>;
    }) {
      const head = token.header
        .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
        .join('');
      const body = token.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`)
              .join('')}</tr>`,
        )
        .join('');
      return `<div class="grove-prose-table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
    },
    // Fenced code blocks: route through Shiki instead of marked's
    // default `<pre><code class="language-…">…</code></pre>`. The
    // returned HTML already wraps in `<pre>` and `<code>`; we
    // hand it to the sanitizer unchanged (Shiki's output is
    // safe by construction — no script / event handlers).
    code({ text, lang }) {
      return highlightCode(text, lang ?? '') + '\n';
    },
  },
});

/**
 * Heading-ID collision counter. Reset at the start of every
 * `renderMarkdownToSafeHtml` call so heading IDs stay stable per
 * body. Module-level state is acceptable because Node is single-
 * threaded per process; the synchronous `marked.parse(body, {async:false})`
 * returns before any other caller can observe the counter.
 */
const headingIds = new Map<string, number>();

// ── Shiki syntax highlighter ─────────────────────────────────────────
//
// Build-time tokenisation for fenced code blocks. Shiki returns a
// string of HTML — `<pre class="shiki …"><code>…</code></pre>` —
// and we drop it straight into the marked output where the code
// block would otherwise be a flat `<pre><code class="language-…">`.
//
// Two themes (light + dark) are loaded; the `defaultColor: false`
// flag asks Shiki to emit CSS variables (`--shiki-light`,
// `--shiki-dark`) instead of inline `color:` declarations. The
// selectors in `styles.css` then swap which set of variables wins
// when the consumer toggles `.dark` on `<html>`. Net effect:
// the same HTML is themed correctly in both modes without us
// re-rendering at runtime.
//
// We use `github-dark-default` rather than `github-dark` for the
// dark side: `github-dark` paints comments at `#6A737D`, which
// fails WCAG AA contrast (3.72:1) against our `--color-ink-950`
// `#171717` code-block background and trips the Lighthouse
// accessibility audit on any record that contains a `# …` shell
// comment. `github-dark-default` shifts comments to `#8B949E`,
// which clears 4.5:1 against the same background (~6.3:1).
//
// `getSingletonHighlighter()` lazily loads the engine on first use
// and caches it for every subsequent call — Shiki's WASM/grammar
// load takes a few hundred ms, so we want to amortise across all
// records in a build. The list of supported languages is curated
// (not `ALL`) so the build doesn't pull Shiki's full grammar pack.
//
// We additionally stash the in-flight promise on `globalThis` under
// a `Symbol.for` key so Vite HMR — which re-evaluates this module
// on every dev-server save — does not throw away the cached
// highlighter and trigger Shiki's "X instances have been created"
// warning. The shared promise is safe to await from any caller; once
// it resolves it stays resolved. The previous engine is released
// exactly once per HMR boundary via `import.meta.hot.dispose`.
const SHIKI_HIGHLIGHTER = Symbol.for('grove.shiki.highlighter');
type GlobalWithShiki = typeof globalThis & {
  [SHIKI_HIGHLIGHTER]?: Promise<Awaited<ReturnType<typeof getSingletonHighlighter>>>;
};
const SUPPORTED_LANGS = [
  'bash',
  'sh',
  'shell',
  'console',
  'python',
  'py',
  'javascript',
  'js',
  'jsx',
  'typescript',
  'ts',
  'tsx',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'markdown',
  'md',
  'mdx',
  'html',
  'css',
  'scss',
  'sass',
  'sql',
  'graphql',
  'dockerfile',
  'diff',
  'rust',
  'go',
  'java',
  'kotlin',
  'swift',
  'ruby',
  'php',
  'c',
  'cpp',
  'csharp',
  'objective-c',
  'xml',
  'ini',
  'properties',
];
const globalAny = globalThis as GlobalWithShiki;
const highlighter = await (globalAny[SHIKI_HIGHLIGHTER] ??= getSingletonHighlighter({
  themes: ['github-light', 'github-dark-default'],
  langs: SUPPORTED_LANGS,
}));

// Release the previous engine's WASM heap on HMR. Without this the
// old engine is unreachable but not disposed, which is the leak
// the Shiki warning was originally hinting at.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    globalAny[SHIKI_HIGHLIGHTER]?.then((h) => h.dispose()).catch(() => {});
  });
}

/**
 * Highlight a fenced code block with Shiki. Returns the Shiki HTML
 * wrapped in our `<pre>`-equivalent class so the existing
 * `.grove-prose pre` rules continue to apply (padding, border,
 * scroll behaviour).
 */
function highlightCode(text: string, lang: string): string {
  const normalized = lang?.toLowerCase() ?? '';
  const safeLang = highlighter.getLoadedLanguages().includes(normalized) ? normalized : 'text';
  const html = highlighter.codeToHtml(text, {
    lang: safeLang,
    themes: { light: 'github-light', dark: 'github-dark-default' },
    defaultColor: false,
  });
  // Strip the outer `<pre>`'s inline `background-color` so it doesn't
  // fight our package's prose background. The per-token `<span>`
  // `style="--shiki-light: …; --shiki-dark: …"` declarations must
  // survive — they're what makes dual-theme work.
  return html.replace(/(<pre[^>]*?)\s+style="[^"]*"/g, '$1');
}

const contentHtmlBySlug = new Map<string, string>();
for (const r of fullRecords) {
  if (r.kind !== 'project') continue;
  const projectRecord = r as ProjectRecord;
  if (!projectRecord.content) continue;
  const read = readContentFile(projectRecord.content);
  if (!read) continue;
  // Each render needs a fresh headingIds map so the per-body
  // collision counter starts at zero (cleared inside
  // `renderMarkdownToSafeHtml`); otherwise the second record in the
  // loop would inherit the first record's counters and duplicate-
  // heading IDs would collide across records.
  try {
    contentHtmlBySlug.set(r.slug, renderMarkdownToSafeHtml(read.body));
  } catch {
    // Missing / unreadable / parse-failed content: skip the record
    // rather than render broken HTML. The page treats `null` as
    // "no Notes section".
  }
}

/**
 *  Pre-sanitized HTML for a record's `content` markdown body, or
 *  `null` if the record has no `content` field / the file is
 *  missing / parse failed. Safe to feed straight into
 *  `set:html` — the render and sanitize steps already ran at
 *  module load.
 */
export function getContentHtml(slug: string): string | null {
  return contentHtmlBySlug.get(slug) ?? null;
}

/**
 * Sanitized Markdown for a consumer-authored page under
 * `content/pages/<page>.md`. Default template pages use this to
 * accept custom copy while keeping Grove's layout and components.
 */
export function getPageContentHtml(page: string): string | null {
  const candidates = [
    resolve(here, '..', '..', 'content', 'pages', `${page}.md`),
    resolve(here, '..', '..', '..', 'content', 'pages', `${page}.md`),
    resolve(process.cwd(), 'content', 'pages', `${page}.md`),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return null;

  try {
    const markdown = stripFrontmatter(readFileSync(path, 'utf8'));
    return renderMarkdownToSafeHtml(markdown, {
      allowlist: PAGE_BODY_ALLOWLIST,
    });
  } catch {
    return null;
  }
}
