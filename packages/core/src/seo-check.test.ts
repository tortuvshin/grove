import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBuiltSite } from './seo-check.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const SITE = 'https://example.com';

function page(opts: {
  path: string;
  title: string;
  description?: string;
  robots?: string;
  canonical?: string;
  body?: string;
}): string {
  const canonical = opts.canonical ?? `${SITE}${opts.path}`;
  return [
    '<html><head>',
    `<title>${opts.title}</title>`,
    `<meta name="description" content="${opts.description ?? `About ${opts.title}`}">`,
    `<meta name="robots" content="${opts.robots ?? 'index,follow'}">`,
    `<link rel="canonical" href="${canonical}">`,
    '<script data-grove-param-robots>/* */</script>',
    '</head><body>',
    opts.body ?? '<p>content</p>',
    '</body></html>',
  ].join('\n');
}

async function site(pages: Record<string, string>, sitemap: string[]) {
  const root = await mkdtemp(join(tmpdir(), 'grove-seo-check-'));
  roots.push(root);
  await mkdir(join(root, 'data', 'generated'), { recursive: true });
  await mkdir(join(root, 'data', 'collections'), { recursive: true });
  await writeFile(
    join(root, 'data', 'generated', 'site-config.json'),
    JSON.stringify({ siteUrl: SITE, blueprintConfig: { routeSlug: 'apps' } }),
  );
  await writeFile(
    join(root, 'data', 'generated', 'records.full.json'),
    JSON.stringify({ records: [] }),
  );
  for (const [path, html] of Object.entries(pages)) {
    const dir = join(root, 'dist', path);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), html);
  }
  await writeFile(
    join(root, 'dist', 'sitemap.xml'),
    `<urlset>${sitemap.map((p) => `<url><loc>${SITE}${p}</loc></url>`).join('')}</urlset>`,
  );
  return root;
}

describe('checkBuiltSite', () => {
  it('passes a consistent site', async () => {
    const root = await site(
      {
        '/': page({ path: '/', title: 'Home' }),
        '/about/': page({ path: '/about/', title: 'About' }),
      },
      ['/', '/about/'],
    );
    const result = await checkBuiltSite({ root });
    expect(result.errors).toEqual([]);
    expect(result.indexable).toBe(2);
  });

  it('flags duplicate titles, a foreign canonical and a page missing from the sitemap', async () => {
    const root = await site(
      {
        '/': page({ path: '/', title: 'Same' }),
        '/a/': page({ path: '/a/', title: 'Same', canonical: `${SITE}/elsewhere/` }),
      },
      ['/'],
    );
    const { errors } = await checkBuiltSite({ root });
    expect(errors).toEqual(
      expect.arrayContaining([
        '/a/: canonical points to https://example.com/elsewhere/',
        '/a/: indexable but not in the sitemap',
        expect.stringMatching(/^duplicate <title> "Same"/),
      ]),
    );
  });

  it('flags a noindex page the sitemap still lists', async () => {
    const root = await site(
      { '/hidden/': page({ path: '/hidden/', title: 'Hidden', robots: 'noindex,follow' }) },
      ['/hidden/'],
    );
    const { errors } = await checkBuiltSite({ root });
    expect(errors).toContain('/hidden/: noindex, but listed in the sitemap');
  });

  it('finds a retired brand in visible text, not in scripts', async () => {
    const root = await site(
      {
        '/': page({
          path: '/',
          title: 'Home',
          body: '<p>Reviewed by Old Name curators</p><script>var x = "Old Name";</script>',
        }),
      },
      ['/'],
    );
    const { errors } = await checkBuiltSite({ root, retiredBrands: ['Old Name'] });
    expect(errors).toEqual(['/: retired brand "Old Name" in page text']);
  });

  it('reports a missing build instead of throwing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grove-seo-check-empty-'));
    roots.push(root);
    const { errors } = await checkBuiltSite({ root });
    expect(errors[0]).toMatch(/does not exist/);
  });
});
