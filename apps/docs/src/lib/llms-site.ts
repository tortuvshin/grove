// Shared site identity + collection-entry mapping for the llms endpoints.
import type { CollectionEntry } from 'astro:content';
import type { LlmsPage, LlmsSite } from './llms';

export const DOCS_SITE: LlmsSite = {
  name: 'Grove',
  url: 'https://withgrove.dev',
  description:
    'Grove is a file-first publishing system for structured knowledge. Source files in, many useful outputs out — web pages, llms.txt, sitemap, JSON-LD, OG images, JSON datasets.',
};

export function toLlmsPage(entry: CollectionEntry<'docs'>): LlmsPage {
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    body: entry.body,
  };
}
