/**
 *  Source of truth: `data/generated/records.{full,index,json}` and
 *  `data/generated/site-config.json`, produced at build time by
 *  `grove generate` from `data/records/*.yml` and `grove.config.ts`.
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
 *  run `grove generate` will fail the build with a clear Vite
 *  resolution error, which is the correct signal — a build that
 *  silently renders an empty directory hides real config mistakes.
 */
import fullPayload from "../../data/generated/records.full.json";
import indexPayload from "../../data/generated/records.index.json";
import siteConfigPayload from "../../data/generated/site-config.json";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type {
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  Resource,
  IndexRecord,
  IndexProjectRecord,
  IndexResourceRecord,
  IndexEntityRecord,
} from "@grove-dev/core";

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
    kind?: "project" | "resource" | "entity";
    routeSlug?: string;
    itemSlug?: string;
    /** V1 canonical field name for the record detail slug
     * (replaces the V0 `itemSlug` field). */
    recordSlug?: string;
    labelSingular?: string;
    labelPlural?: string;
  };
  name?: string;
}

const fullRecordsRaw: Resource[] = (fullPayload as FullPayload).records ?? [];
const indexRecordsRaw: IndexRecord[] =
  (indexPayload as unknown as IndexPayload).records ?? [];
const siteConfigRaw: SiteConfigPayload = siteConfigPayload as SiteConfigPayload;

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
export const projects = records.filter(
  (r): r is IndexProjectRecord => r.kind === "project",
);

export const resources = records.filter(
  (r): r is IndexResourceRecord => r.kind === "resource",
);

/** Entity-kind records — slim shape. */
export const entities = records.filter(
  (r): r is IndexEntityRecord => r.kind === "entity",
);

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
  return r && r.kind === "project" ? r : undefined;
}

export function resourceBySlug(slug: string): ResourceRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "resource" ? r : undefined;
}

export function entityBySlug(slug: string): EntityRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "entity" ? r : undefined;
}

// ──────────────────────────────────────────────────────────────────────
// Blueprint-aware generic helpers
// ──────────────────────────────────────────────────────────────────────
//
// Every page (home, list, detail, submit) needs to know the
// route slug, the kind filter, and the human label. Rather than
// hardcode "project" / "projects" / "kind: project" at every
// call-site, we derive them once from `site-config.json`'s
// `blueprintConfig` block (populated by `grove generate`).
//
// `indexSlug()` and `itemLabel()` retain their old signatures
// (zero-arg) so existing pages keep working — they now read from
// the JSON instead of a switch statement.

const blueprintConfig = siteConfigRaw.blueprintConfig ?? {};
const blueprintKind = (blueprintConfig.kind ?? "project") as
  | "project"
  | "resource"
  | "entity";
const blueprintId = (blueprintConfig.id ?? "project-directory") as
  | "project-directory"
  | "resource-hub"
  | "ecosystem-map";

/**
 * URL slug for the directory index page (e.g. `/projects/`,
 * `/resources/`, `/entities/`). Override in `grove.config.ts`
 * via `routes.directory` — reflected through to here at generate
 * time.
 */
export function indexSlug(): string {
  return blueprintConfig.routeSlug ?? "projects";
}

/** URL slug for a single record detail page (the dynamic
 * `[recordSlug]` segment). Default "project" for backwards-compat
 * with V0-published configs that exposed the field as `itemSlug`. */
export function recordSlugConfig(): string {
  return blueprintConfig.recordSlug ?? blueprintConfig.itemSlug ?? "project";
}

/** Singular human label, e.g. "project", "resource", "entity". */
export function itemLabel(): string {
  return blueprintConfig.labelSingular ?? "project";
}

/** Plural human label, e.g. "projects", "resources", "entities". */
export function itemLabelPlural(): string {
  return blueprintConfig.labelPlural ?? "projects";
}

/** Active blueprint id. */
export function blueprintIdFn(): string {
  return blueprintId;
}

/** Active record kind discriminator. */
export function activeKind(): "project" | "resource" | "entity" {
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
    case "resource":
      return resources;
    case "entity":
      return entities;
    case "project":
    default:
      return projects;
  }
})();

/** Generic full-record alias. */
export const fullItems: Resource[] = (() => {
  return fullRecords.filter((r) => r.kind === blueprintKind);
})();

export const fullProjects: ProjectRecord[] = fullRecords.filter(
  (record): record is ProjectRecord => record.kind === "project",
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
function resolveContentPath(contentPath: string): string {
  const candidates = [
    resolve(here, "..", "..", contentPath),
    resolve(here, "..", "..", "..", contentPath),
    resolve(process.cwd(), contentPath),
  ];
  return candidates.find((p) => existsSync(p)) ?? "";
}

const contentHtmlBySlug = new Map<string, string>();
for (const r of fullRecords) {
  if (r.kind !== "project") continue;
  const projectRecord = r as ProjectRecord;
  if (!projectRecord.content) continue;
  const path = resolveContentPath(projectRecord.content);
  if (!path) continue;
  try {
    const text = readFileSync(path, "utf8");
    // `async: false` keeps the call synchronous so we can populate
    // the map at module-load time. (marked v18 defaults to
    // Promise-returning; v9-17 also support this flag.)
    const rawHtml = marked.parse(text, { async: false }) as string;
    const safeHtml = sanitizeHtml(rawHtml, {
      allowedTags: [
        "h1", "h2", "h3", "h4",
        "p", "br", "hr",
        "ul", "ol", "li",
        "strong", "em", "b", "i", "u", "s", "del",
        "a", "code", "pre", "blockquote",
      ],
      allowedAttributes: {
        a: ["href", "title", "rel", "target"],
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowedSchemesByTag: { a: ["http", "https", "mailto", "tel"] },
      transformTags: {
        a: sanitizeHtml.simpleTransform("a", {
          rel: "noopener noreferrer",
          target: "_blank",
        }, true),
      },
      disallowedTagsMode: "discard",
    });
    contentHtmlBySlug.set(r.slug, safeHtml);
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
    resolve(here, "..", "..", "content", "pages", `${page}.md`),
    resolve(here, "..", "..", "..", "content", "pages", `${page}.md`),
    resolve(process.cwd(), "content", "pages", `${page}.md`),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return null;

  try {
    const rawHtml = marked.parse(readFileSync(path, "utf8"), { async: false }) as string;
    return sanitizeHtml(rawHtml, {
      allowedTags: [
        "h1", "h2", "h3", "h4",
        "p", "br", "hr",
        "ul", "ol", "li",
        "strong", "em", "b", "i", "u", "s", "del",
        "a", "code", "pre", "blockquote", "img",
      ],
      allowedAttributes: {
        a: ["href", "title", "rel", "target"],
        img: ["src", "alt", "title", "width", "height", "loading"],
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowedSchemesByTag: {
        a: ["http", "https", "mailto", "tel"],
        img: ["http", "https"],
      },
      transformTags: {
        a: sanitizeHtml.simpleTransform("a", {
          rel: "noopener noreferrer",
          target: "_blank",
        }, true),
      },
      disallowedTagsMode: "discard",
    });
  } catch {
    return null;
  }
}
