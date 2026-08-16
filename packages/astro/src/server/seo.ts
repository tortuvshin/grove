/**
 * SEO primitives — the ONE place page titles, meta descriptions, OG
 * image paths, and breadcrumb JSON-LD are shaped.
 *
 * Every page model funnels through `seoTitle` / `seoDescription`, so
 * the separator (` | ` before the site name, ` — ` inside the main
 * part), the length caps, and the truncation rules can never drift
 * between pages. The pure helpers take every input as an argument —
 * no generated-data imports — so they are unit-testable in isolation.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { breadcrumbSchema, type JsonLdNode } from "@grove-dev/core";

/** Everything a page passes to BaseLayout for its `<head>`. */
export interface PageSeo {
  title: string;
  description: string;
  /** Root-relative OG image (e.g. "/og/records/langchain.png"). */
  image?: string;
  imageAlt?: string;
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
}

/** Google truncates titles around 60 chars; suffixing past ~65 only
 *  buys an ellipsis, so the suffix is skipped instead of clipped. */
const TITLE_SUFFIX_MAX = 65;
/** Meta descriptions display up to ~160 chars in search results. */
const DESCRIPTION_MAX = 160;

/**
 * Compose `<main> | <siteName>`. The suffix is dropped when the main
 * part already names the site (taxonomy titles end "... on {Site}")
 * or when appending it would push the title past the display cap —
 * a truncated site name is worse than none.
 */
export function seoTitle(main: string, siteName: string): string {
  const cleaned = main.trim();
  if (!cleaned) return siteName;
  if (!siteName || cleaned.includes(siteName)) return cleaned;
  const suffixed = `${cleaned} | ${siteName}`;
  return suffixed.length <= TITLE_SUFFIX_MAX ? suffixed : cleaned;
}

/**
 * Normalize a meta description: prefer `raw`, fall back, collapse
 * whitespace, and truncate on a word boundary near 160 chars.
 */
export function seoDescription(raw: string | undefined, fallback: string): string {
  const source = (raw ?? "").replace(/\s+/g, " ").trim() || fallback.replace(/\s+/g, " ").trim();
  if (source.length <= DESCRIPTION_MAX) return source;
  const cut = source.slice(0, DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/** Capitalize the first character (for titles like "Browse Projects"). */
export function titleCaseFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Short record descriptor for `<Name> — <descriptor> | <Site>` titles.
 * Prefers the curator-written summary's first clause when it is short
 * enough to fit a title; otherwise falls back to a generated
 * "Open-source <category> <singular>" phrase.
 */
export function recordSeoDescriptor(input: {
  summary?: string;
  categoryLabel?: string;
  singular: string;
}): string {
  const clause = (input.summary ?? "")
    .split(/[.!?\n]|\s[—–]\s/)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (clause && clause.length > 0 && clause.length <= 45) return clause;
  const category = input.categoryLabel?.trim();
  return category && category.toLowerCase() !== "uncategorized"
    ? `Open-source ${category} ${input.singular}`
    : `Open-source ${input.singular}`;
}

export type OgKind =
  | "home"
  | "default"
  | "record"
  | "collection"
  | "category"
  | "stack"
  | "license";

const OG_DIR: Record<OgKind, string> = {
  home: "home.png",
  default: "default.png",
  record: "records",
  collection: "collections",
  category: "categories",
  stack: "stacks",
  license: "licenses",
};

/**
 * Resolve the OG image URL for a page. Returns the generated
 * `/og/...png` when the build pipeline produced it, otherwise the
 * site-wide `/og-image.svg` — so a failed or skipped OG build
 * degrades to the static default instead of a 404.
 */
export function ogPath(kind: OgKind, slug?: string, cwd = process.cwd()): string {
  const rel =
    kind === "home" || kind === "default"
      ? `og/${OG_DIR[kind]}`
      : slug
        ? `og/${OG_DIR[kind]}/${slug}.png`
        : "og/default.png";
  if (existsSync(resolve(cwd, "public", rel))) return `/${rel}`;
  // Per-page image missing — try the generated default before the SVG.
  if (rel !== "og/default.png" && existsSync(resolve(cwd, "public", "og/default.png"))) {
    return "/og/default.png";
  }
  return "/og-image.svg";
}

/** Join a site-relative path onto the site URL (trailing-slash safe). */
export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/**
 * BreadcrumbList JSON-LD from site-relative paths. Wraps core's
 * `breadcrumbSchema` so pages pass paths, not absolute URLs.
 */
export function breadcrumbs(
  siteUrl: string,
  crumbs: Array<{ path: string; name: string }>,
): JsonLdNode {
  return breadcrumbSchema(
    crumbs.map((c) => ({ url: absoluteUrl(siteUrl, c.path.endsWith("/") || c.path === "" ? c.path : `${c.path}/`), name: c.name })),
  );
}
