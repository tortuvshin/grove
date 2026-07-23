const FILTER_PATTERNS = [
  /^\/browse\?/,
  /^\/search\?/,
  /^\/apps\?/,
  /^\/.*\?.*(?:q|sort|page|filter)=/,
];

export function buildRobotsTxt(input: { siteUrl: string; disallow?: string[] }): string {
  const site = input.siteUrl.endsWith("/") ? input.siteUrl : `${input.siteUrl}/`;
  const disallow = (input.disallow ?? []).map((p) => `Disallow: ${p}`).join("\n");
  return [
    "User-agent: *",
    "Allow: /",
    disallow,
    "",
    `Sitemap: ${site}sitemap-index.xml`,
    "",
  ].filter((line) => line !== "").join("\n");
}

export function isIndexableFilterPath(path: string): boolean {
  return !FILTER_PATTERNS.some((p) => p.test(path));
}
