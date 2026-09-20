// Shared site identity + collection-entry mapping for the llms endpoints.
import type { CollectionEntry } from 'astro:content';
import type { LlmsPage, LlmsSite } from './llms';

export const DOCS_SITE: LlmsSite = {
  name: 'Grove',
  url: 'https://withgrove.dev',
  description:
    'Grove is a file-first framework for curated directories and catalogs, built on Astro. Records in YAML and Markdown in; a searchable site, llms.txt, sitemap, JSON-LD, OG images, and JSON datasets out.',
};

export function toLlmsPage(entry: CollectionEntry<'docs'>): LlmsPage {
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    body: entry.body,
  };
}
