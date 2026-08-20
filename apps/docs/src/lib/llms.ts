// Builders for the /llms.txt and /llms-full.txt outputs of the docs site
// (https://llmstxt.org). Pure functions over plain data so they are
// unit-testable without Astro; the endpoints in src/pages/llms{,-full}.txt.ts
// feed them the `docs` content collection and the shared sidebar.

export interface LlmsPage {
  /** Content-collection id, e.g. "getting-started/scaffold". */
  slug: string;
  title: string;
  description?: string;
  /** Raw markdown body (llms-full.txt only). */
  body?: string;
}

interface SidebarItem {
  label: string;
  slug?: string;
  items?: SidebarItem[];
}

export interface LlmsSite {
  name: string;
  url: string;
  description: string;
}

export function docSlugToUrl(slug: string, siteUrl: string): string {
  return new URL(`/${slug}/`, siteUrl).toString();
}

/** Depth-first slugs of a sidebar group, in display order. */
function groupSlugs(items: SidebarItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.slug ? [item.slug] : []),
    ...(item.items ? groupSlugs(item.items) : []),
  ]);
}

function linkLine(page: LlmsPage, siteUrl: string): string {
  const link = `- [${page.title}](${docSlugToUrl(page.slug, siteUrl)})`;
  return page.description ? `${link}: ${page.description}` : link;
}

/**
 * llms.txt — a compact, sectioned index of every docs page, grouped by the
 * real sidebar sections. Pages that are not in the sidebar (e.g. the
 * nav-only roadmap and FAQ) land in a trailing "Other" section so nothing
 * is silently dropped.
 */
export function buildDocsLlmsTxt(input: {
  site: LlmsSite;
  pages: LlmsPage[];
  sidebar: SidebarItem[];
}): string {
  const { site, pages, sidebar } = input;
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const seen = new Set<string>();

  const sections: string[] = [];
  for (const group of sidebar) {
    const lines = groupSlugs(group.items ?? [])
      .map((slug) => {
        const page = bySlug.get(slug);
        if (!page) return undefined;
        seen.add(slug);
        return linkLine(page, site.url);
      })
      .filter((line): line is string => Boolean(line));
    if (lines.length > 0) sections.push(`## ${group.label}\n\n${lines.join('\n')}`);
  }

  const rest = pages.filter((page) => !seen.has(page.slug));
  if (rest.length > 0) {
    sections.push(`## Other\n\n${rest.map((page) => linkLine(page, site.url)).join('\n')}`);
  }

  return [`# ${site.name}`, `> ${site.description}`, ...sections].join('\n\n') + '\n';
}

/**
 * llms-full.txt — the full markdown content of every docs page in one file,
 * each section prefixed with its title, canonical URL, and description.
 */
export function buildDocsLlmsFullTxt(input: { site: LlmsSite; pages: LlmsPage[] }): string {
  const { site, pages } = input;
  const header = `# ${site.name} — full documentation\n\n> ${site.description}`;
  const sections = pages.map((page) => {
    const lines = [`# ${page.title}`, ``, `URL: ${docSlugToUrl(page.slug, site.url)}`];
    if (page.description) lines.push(``, page.description);
    const body = page.body?.trim();
    if (body) lines.push(``, body);
    return lines.join('\n');
  });
  return [header, ...sections].join('\n\n---\n\n') + '\n';
}
