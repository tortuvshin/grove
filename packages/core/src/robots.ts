const FILTER_PATTERNS = [/^\/browse\?/, /^\/search\?/, /^\/apps\?/];

export function buildRobotsTxt(input: { siteUrl: string; disallow?: string[] }): string {
  const site = input.siteUrl.endsWith('/') ? input.siteUrl : `${input.siteUrl}/`;
  const disallow = (input.disallow ?? []).map((p) => `Disallow: ${p}`).join('\n');
  return [
    'User-agent: *',
    'Allow: /',
    disallow,
    '',
    // The sitemap writer (`buildSitemap`) emits `public/sitemap.xml`.
    // Pointing robots.txt at any other filename sends crawlers to a 404.
    `Sitemap: ${site}sitemap.xml`,
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export function isIndexableFilterPath(path: string): boolean {
  return !FILTER_PATTERNS.some((p) => p.test(path));
}
