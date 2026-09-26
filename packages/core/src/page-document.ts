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
  | 'home'
  | 'directory'
  | 'collection'
  | 'record'
  | 'content'
  | 'empty'
  | '404';

export interface OpenGraphMetadata {
  title: string;
  description: string;
  url: string;
  image: string;
  type: 'website' | 'article';
  siteName?: string;
}

export interface TwitterMetadata {
  card: 'summary' | 'summary_large_image';
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
  '@context': 'https://schema.org';
  '@type': string | string[];
  '@id'?: string;
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
    throw new Error('PageDocument: title is required');
  }
  if (!input.metadata.description.trim()) {
    throw new Error('PageDocument: description is required');
  }
  if (input.metadata.title === input.metadata.description) {
    throw new Error('PageDocument: title and description must differ');
  }
  if (input.metadata.openGraph.url !== input.identity.canonical.toString()) {
    throw new Error('PageDocument: openGraph.url must equal identity.canonical');
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
      '@context': 'https://schema.org',
      '@type': ['WebSite', 'Organization'],
      '@id': `${input.url}#site`,
      url: input.url,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
      publisher: {
        '@type': 'Organization',
        '@id': `${input.orgUrl}#org`,
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
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
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
  /**
   * Size of the full list when `items` is a capped slice of it.
   * `numberOfItems` reports this so the markup never claims fewer
   * entries than the page renders. Defaults to `items.length`.
   */
  totalItems?: number;
  crumbs: Crumb[];
}

export function collectionSchema(input: CollectionInput): JsonLdNode[] {
  if (input.crumbs.length < 2) {
    throw new Error('collectionSchema: breadcrumbs must contain at least 2 items');
  }
  const page: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': ['CollectionPage', 'WebPage'],
    '@id': `${input.url}#page`,
    url: input.url,
    name: input.name,
    description: input.description,
  };
  const list: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: Math.max(input.totalItems ?? 0, input.items.length),
    itemListElement: input.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: item.url,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
  return [page, list, breadcrumbSchema(input.crumbs)];
}

export interface FaqInput {
  /** Canonical URL of the page the questions are answered on. */
  url: string;
  items: Array<{ question: string; answer: string }>;
}

/**
 * `FAQPage` node for a page that answers questions in its visible
 * content. Emit it only for questions the page actually shows — markup
 * for hidden text is a structured-data violation.
 *
 * Google limits FAQ rich results to a small set of authoritative sites,
 * so don't expect the expandable SERP treatment; the node still tells
 * crawlers and LLM pipelines which text is a question and which its answer.
 */
export function faqSchema(input: FaqInput): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${input.url}#faq`,
    mainEntity: input.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface RecordInput {
  url: string;
  name: string;
  description: string;
  kind: 'application' | 'article';
  repoUrl?: string;
  license?: string;
  crumbs: Crumb[];
}

export function recordSchema(input: RecordInput): JsonLdNode[] {
  const main: JsonLdNode =
    input.kind === 'application'
      ? softwareApplicationSchema({
          url: input.url,
          name: input.name,
          description: input.description,
          ...(input.repoUrl ? { repoUrl: input.repoUrl } : {}),
          ...(input.license ? { license: input.license } : {}),
        })
      : {
          '@context': 'https://schema.org',
          '@type': ['CreativeWork', 'WebPage'],
          '@id': `${input.url}#record`,
          url: input.url,
          name: input.name,
          description: input.description,
          ...(input.license ? { license: input.license } : {}),
        };
  return [main, breadcrumbSchema(input.crumbs)];
}

/**
 * Every property `softwareApplicationSchema` can emit. Each one comes
 * from the record, the page, or the GitHub API — nothing is inferred.
 * `offers`, `aggregateRating`, `review` and `isAccessibleForFree` are
 * deliberately absent: a directory has no verified price or rating, and
 * open source is not the same as free in a store. Exported so a site's
 * SEO gate can hold its pages to the same list.
 */
export const SOFTWARE_APPLICATION_FIELDS = [
  '@context',
  '@type',
  '@id',
  'name',
  'description',
  'url',
  'codeRepository',
  'sameAs',
  'license',
  'operatingSystem',
  'applicationCategory',
  'downloadUrl',
  'programmingLanguage',
  'dateCreated',
  'dateModified',
  'author',
  'keywords',
] as const;

/** SPDX ids GitHub reports when it cannot identify a license. */
const UNKNOWN_LICENSES = new Set(['NOASSERTION', 'OTHER']);

export interface SoftwareApplicationInput {
  /** Canonical page URL; the node's `@id` is `<url>#record`. */
  url: string;
  name: string;
  description: string;
  /** Source repository — `codeRepository`, and first in `sameAs`. */
  repoUrl?: string;
  /** The project's own website — added to `sameAs`. */
  homepageUrl?: string;
  /** SPDX id as detected by GitHub. `NOASSERTION` / `OTHER` are dropped;
   *  an SPDX id becomes its spdx.org URL. */
  license?: string | null;
  /** Platform labels (e.g. "Android", "iOS") — `operatingSystem`. */
  platforms?: string[];
  /** Category label — `applicationCategory`. */
  category?: string;
  /** URLs of distribution channels a curator marked `verified: true`.
   *  Unverified channels must not be passed. */
  downloadUrls?: string[];
  /** Primary language as reported by GitHub. */
  programmingLanguage?: string | null;
  /** Repository creation / last push, from GitHub. */
  dateCreated?: string | null;
  dateModified?: string | null;
  /** Repository owner. Emitted only with a type GitHub reported
   *  (`User` → Person, `Organization` → Organization). */
  owner?: { login: string; type?: string | null; url?: string };
  keywords?: string[];
}

function licenseUrl(spdx: string | null | undefined): string | undefined {
  if (!spdx || UNKNOWN_LICENSES.has(spdx.toUpperCase())) return undefined;
  return `https://spdx.org/licenses/${spdx}.html`;
}

/**
 * `["SoftwareApplication", "SoftwareSourceCode"]` node for an app
 * record, limited to `SOFTWARE_APPLICATION_FIELDS`. Missing inputs are
 * left out rather than filled with a default.
 */
export function softwareApplicationSchema(input: SoftwareApplicationInput): JsonLdNode {
  const sameAs = [input.repoUrl, input.homepageUrl].filter((url): url is string => Boolean(url));
  const downloadUrls = [...new Set(input.downloadUrls ?? [])];
  const license = licenseUrl(input.license);
  const authorType =
    input.owner?.type === 'User'
      ? 'Person'
      : input.owner?.type === 'Organization'
        ? 'Organization'
        : undefined;
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${input.url}#record`,
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.repoUrl ? { codeRepository: input.repoUrl } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(license ? { license } : {}),
    ...(input.platforms?.length ? { operatingSystem: input.platforms.join(', ') } : {}),
    ...(input.category ? { applicationCategory: input.category } : {}),
    ...(downloadUrls.length
      ? { downloadUrl: downloadUrls.length === 1 ? downloadUrls[0] : downloadUrls }
      : {}),
    ...(input.programmingLanguage ? { programmingLanguage: input.programmingLanguage } : {}),
    ...(input.dateCreated ? { dateCreated: input.dateCreated } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.owner && authorType
      ? {
          author: {
            '@type': authorType,
            name: input.owner.login,
            url: input.owner.url ?? `https://github.com/${input.owner.login}`,
          },
        }
      : {}),
    ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
  };
  return node;
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
      '@context': 'https://schema.org',
      '@type': ['Article', 'WebPage'],
      '@id': `${input.url}#article`,
      url: input.url,
      headline: input.headline,
      description: input.description,
      author: { '@type': 'Organization', name: input.author },
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    },
    breadcrumbSchema(input.crumbs),
  ];
}

export function buildJsonLd(input: SiteInput): JsonLdNode[];
export function buildJsonLd(input: CollectionInput): JsonLdNode[];
export function buildJsonLd(input: RecordInput): JsonLdNode[];
export function buildJsonLd(input: ContentInput): JsonLdNode[];
export function buildJsonLd(
  input: SiteInput | CollectionInput | RecordInput | ContentInput,
): JsonLdNode[] {
  if ('orgName' in input) return siteSchema(input);
  if ('items' in input) return collectionSchema(input);
  if ('kind' in input) return recordSchema(input);
  if ('headline' in input) return contentSchema(input);
  throw new Error('buildJsonLd: unknown schema input');
}

export interface JsonLdValidationIssue {
  code: 'missing-context' | 'missing-type' | 'relative-url' | 'duplicate-id' | 'invalid-date';
  field?: string;
  message: string;
}

const URL_FIELDS = new Set(['url', 'codeRepository', 'logo', 'image', 'sameAs', 'downloadUrl']);

export function validateJsonLd(nodes: JsonLdNode[]): JsonLdValidationIssue[] {
  const issues: JsonLdValidationIssue[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node['@context'] !== 'https://schema.org') {
      issues.push({
        code: 'missing-context',
        message: '@context must be https://schema.org',
      });
    }
    if (!node['@type']) {
      issues.push({ code: 'missing-type', message: '@type is required' });
    }
    if (node['@id']) {
      if (seen.has(node['@id'])) {
        issues.push({
          code: 'duplicate-id',
          message: `Duplicate @id: ${node['@id']}`,
        });
      }
      seen.add(node['@id']);
    }
    for (const [field, value] of Object.entries(node)) {
      if (field.startsWith('@')) continue;
      if (URL_FIELDS.has(field) && typeof value === 'string' && !/^https?:\/\//.test(value)) {
        issues.push({
          code: 'relative-url',
          field,
          message: `${field} must be absolute: ${value}`,
        });
      }
      if (field === 'datePublished' && typeof value === 'string' && isNaN(Date.parse(value))) {
        issues.push({
          code: 'invalid-date',
          field,
          message: `datePublished invalid: ${value}`,
        });
      }
    }
  }
  return issues;
}
