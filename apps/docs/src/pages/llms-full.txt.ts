import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildDocsLlmsFullTxt } from '../lib/llms';
import { DOCS_SITE, toLlmsPage } from '../lib/llms-site';

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs');
  const body = buildDocsLlmsFullTxt({
    site: DOCS_SITE,
    pages: docs.map(toLlmsPage),
  });
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
