/**
 * PageDocument — the unified page-level contract for every page in a Grove
 * project. A `PageDocument` declares the page's identity, its rendered
 * metadata (title, description, OG, Twitter), the JSON-LD nodes it wants
 * emitted, and its discovery profile (sitemap, llms, related links).
 *
 * Everything the framework renders in `<head>` (title, description,
 * canonical, OG, Twitter, JSON-LD) is derived from this single model.
 * `definePageDocument` is the canonical constructor — it validates the
 * invariants (title present, OG URL matches canonical, etc.) so callers
 * can't accidentally construct a malformed document.
 *
 * The JSON-LD registry (`siteSchema`, `collectionSchema`, `recordSchema`,
 * `contentSchema`, `buildJsonLd`) is a small blueprint layer: each schema
 * function takes a typed input and returns the JSON-LD node graph the
 * consumer serializes into `<script type="application/ld+json">` in its
 * own `<head>` (e.g. via the adapter's `Seo` component).
 *
 * `validateJsonLd` is the validator that runs over a node graph and
 * reports well-formedness issues (missing @context, relative URLs, duplicate
 * @ids, invalid dates). It is designed to be wired into the build pipeline
 * so a malformed page fails fast.
 */

export type DocumentPageType =
  | "home"
  | "directory"
  | "collection"
  | "record"
  | "content"
  | "empty"
  | "404";

export interface OpenGraphMetadata {
  title: string;
  description: string;
  url: string;
  image: string;
  type: "website" | "article";
  siteName?: string;
}

export interface TwitterMetadata {
  card: "summary" | "summary_large_image";
  site?: string;
  creator?: string;
}

export interface PageMetadata {
  title: string;
  description: string;
  robots: string;
  openGraph: OpenGraphMetadata;
  twitter: TwitterMetadata;
}

export interface LinkedDocument {
  url: string;
  title: string;
  description?: string;
}

export interface JsonLdNode {
  "@context": "https://schema.org";
  "@type": string | string[];
  "@id"?: string;
  [key: string]: unknown;
}

export interface PageDiscovery {
  includeInSitemap: boolean;
  includeInLlms: boolean;
  relatedLinks: LinkedDocument[];
}

export interface PageIdentity {
  type: DocumentPageType;
  canonical: URL;
  language: string;
  hreflang?: string[];
}

export interface PageDocument {
  identity: PageIdentity;
  metadata: PageMetadata;
  structuredData: JsonLdNode[];
  discovery: PageDiscovery;
}

export function definePageDocument(input: PageDocument): PageDocument {
  if (!input.metadata.title.trim()) {
    throw new Error("PageDocument: title is required");
  }
  if (!input.metadata.description.trim()) {
    throw new Error("PageDocument: description is required");
  }
  if (input.metadata.title === input.metadata.description) {
    throw new Error("PageDocument: title and description must differ");
  }
  if (input.metadata.openGraph.url !== input.identity.canonical.toString()) {
    throw new Error("PageDocument: openGraph.url must equal identity.canonical");
  }
  return input;
}

export interface Crumb {
  url: string;
  name: string;
}

export interface SiteInput {
  url: string;
  name: string;
  description?: string;
  orgName: string;
  orgUrl: string;
  orgLogo?: string;
  /** BCP-47 language tag emitted as `inLanguage` (e.g. "en"). */
  inLanguage?: string;
  /** Absolute sameAs URLs (repo, social profiles) for the Organization. */
  sameAs?: string[];
}

export function siteSchema(input: SiteInput): JsonLdNode[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": ["WebSite", "Organization"],
      "@id": `${input.url}#site`,
      url: input.url,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
      publisher: {
        "@type": "Organization",
        "@id": `${input.orgUrl}#org`,
        name: input.orgName,
        url: input.orgUrl,
        ...(input.orgLogo ? { logo: input.orgLogo } : {}),
        ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
      },
    },
  ];
}

/**
 * Standalone BreadcrumbList node. The shared shape behind
 * collection/record/content schemas, exported so adapters can attach
 * breadcrumbs to pages that need nothing else (about, contributors).
 */
export function breadcrumbSchema(crumbs: Crumb[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

export interface CollectionInput {
  url: string;
  name: string;
  description: string;
  items: Array<{ url: string; name: string; description?: string }>;
  crumbs: Crumb[];
}

export function collectionSchema(input: CollectionInput): JsonLdNode[] {
  if (input.crumbs.length < 2) {
    throw new Error(
      "collectionSchema: breadcrumbs must contain at least 2 items",
    );
  }
  const page: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": ["CollectionPage", "WebPage"],
    "@id": `${input.url}#page`,
    url: input.url,
    name: input.name,
    description: input.description,
  };
  const list: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: item.url,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
  return [page, list, breadcrumbSchema(input.crumbs)];
}

export interface RecordInput {
  url: string;
  name: string;
  description: string;
  kind: "application" | "article";
  repoUrl?: string;
  license?: string;
  crumbs: Crumb[];
}

export function recordSchema(input: RecordInput): JsonLdNode[] {
  const isApp = input.kind === "application";
  const main: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": isApp
      ? ["SoftwareApplication", "SoftwareSourceCode"]
      : ["CreativeWork", "WebPage"],
    "@id": `${input.url}#record`,
    url: input.url,
    name: input.name,
    description: input.description,
    ...(isApp && input.repoUrl ? { codeRepository: input.repoUrl } : {}),
    ...(input.license ? { license: input.license } : {}),
  };
  return [main, breadcrumbSchema(input.crumbs)];
}

export interface ContentInput {
  url: string;
  headline: string;
  description: string;
  author: string;
  datePublished?: string;
  crumbs: Crumb[];
}

export function contentSchema(input: ContentInput): JsonLdNode[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Article", "WebPage"],
      "@id": `${input.url}#article`,
      url: input.url,
      headline: input.headline,
      description: input.description,
      author: { "@type": "Organization", name: input.author },
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    },
    breadcrumbSchema(input.crumbs),
  ];
}

export function buildJsonLd(input: SiteInput): JsonLdNode[];
export function buildJsonLd(input: CollectionInput): JsonLdNode[];
export function buildJsonLd(input: RecordInput): JsonLdNode[];
export function buildJsonLd(input: ContentInput): JsonLdNode[];
export function buildJsonLd(input: SiteInput | CollectionInput | RecordInput | ContentInput): JsonLdNode[] {
  if ("orgName" in input) return siteSchema(input);
  if ("items" in input) return collectionSchema(input);
  if ("kind" in input) return recordSchema(input);
  if ("headline" in input) return contentSchema(input);
  throw new Error("buildJsonLd: unknown schema input");
}

export interface JsonLdValidationIssue {
  code:
    | "missing-context"
    | "missing-type"
    | "relative-url"
    | "duplicate-id"
    | "invalid-date";
  field?: string;
  message: string;
}

const URL_FIELDS = new Set(["url", "codeRepository", "logo", "image", "sameAs"]);

export function validateJsonLd(nodes: JsonLdNode[]): JsonLdValidationIssue[] {
  const issues: JsonLdValidationIssue[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node["@context"] !== "https://schema.org") {
      issues.push({
        code: "missing-context",
        message: "@context must be https://schema.org",
      });
    }
    if (!node["@type"]) {
      issues.push({ code: "missing-type", message: "@type is required" });
    }
    if (node["@id"]) {
      if (seen.has(node["@id"])) {
        issues.push({
          code: "duplicate-id",
          message: `Duplicate @id: ${node["@id"]}`,
        });
      }
      seen.add(node["@id"]);
    }
    for (const [field, value] of Object.entries(node)) {
      if (field.startsWith("@")) continue;
      if (
        URL_FIELDS.has(field) &&
        typeof value === "string" &&
        !/^https?:\/\//.test(value)
      ) {
        issues.push({
          code: "relative-url",
          field,
          message: `${field} must be absolute: ${value}`,
        });
      }
      if (
        field === "datePublished" &&
        typeof value === "string" &&
        isNaN(Date.parse(value))
      ) {
        issues.push({
          code: "invalid-date",
          field,
          message: `datePublished invalid: ${value}`,
        });
      }
    }
  }
  return issues;
}
