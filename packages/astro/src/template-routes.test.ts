import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const siteRoot = resolve(import.meta.dirname, '../../../apps/example');
const pagesDir = resolve(siteRoot, 'src/pages');

describe('default Astro route configuration', () => {
  it('ships TypeScript settings that resolve package exports and Node built-ins', async () => {
    const tsconfig = JSON.parse(await readFile(resolve(siteRoot, 'tsconfig.json'), 'utf8')) as {
      extends?: string;
      compilerOptions?: {
        moduleResolution?: string;
        types?: string[];
      };
    };
    const manifest = JSON.parse(await readFile(resolve(siteRoot, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(tsconfig.extends).toBe('astro/tsconfigs/base');
    expect(tsconfig.compilerOptions?.moduleResolution).toBe('Bundler');
    expect(tsconfig.compilerOptions?.types).toContain('node');
    expect(manifest.devDependencies?.['@types/node']).toMatch(/^\^/);
  });

  it('treats generated JSON as an untyped boundary before applying payload types', async () => {
    const recordsModule = await readFile(
      resolve(import.meta.dirname, 'server/directory.ts'),
      'utf8',
    );

    expect(recordsModule).toContain('fullPayload as unknown as FullPayload');
  });

  it('derives the directory route from generated site config', async () => {
    const listPage = await readFile(resolve(pagesDir, '[slug]/index.astro'), 'utf8');

    expect(listPage).toContain('siteConfig.blueprintConfig?.routeSlug');
  });

  it('does not ship an Open Apps-specific legacy route', async () => {
    const aliasExists = await stat(resolve(pagesDir, 'apps/[recordSlug].astro'))
      .then(() => true)
      .catch(() => false);

    expect(aliasExists).toBe(false);
  });

  it('renders consumer-authored about Markdown through the default page', async () => {
    const aboutPage = await readFile(resolve(pagesDir, 'about.astro'), 'utf8');

    expect(aboutPage).toMatch(/getPageContentHtml\(['"]about['"]\)/);
  });

  it('generates submission drafts accepted by the Grove record schema', async () => {
    const submitClient = await readFile(
      resolve(
        import.meta.dirname,
        '../../registry/default/components/grove/submission-client.astro',
      ),
      'utf8',
    );

    expect(submitClient).toContain('"  type: manual"');
    expect(submitClient).not.toContain('"  type: github"');
  });

  it('keeps generic maintenance behavior in Grove instead of consumer scripts', async () => {
    const manifest = JSON.parse(await readFile(resolve(siteRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scriptsDirExists = await stat(resolve(siteRoot, 'scripts'))
      .then(() => true)
      .catch(() => false);

    expect(manifest.scripts).toMatchObject({
      dev: 'astro dev',
      build: 'astro build',
      check: 'astro check',
    });
    expect(manifest.scripts?.['sync:contributors']).toBeUndefined();
    expect(scriptsDirExists).toBe(false);
  });

  it('hydrates static list pages with URL-driven search and pagination', async () => {
    const listClient = await readFile(
      resolve(
        import.meta.dirname,
        '../../registry/default/components/grove/directory-index-client.astro',
      ),
      'utf8',
    );

    // The record index is fetched, not inlined: a paginated page must
    // not carry the whole directory in its HTML.
    expect(listClient).toContain('/page/records.json');
    expect(listClient).not.toContain('id="grove-index-data"');
    expect(listClient).toContain('id="grove-index-config"');
    expect(listClient).toContain('function applyClientFilters()');
    expect(listClient).toContain('from "@grove-dev/core/directory"');
    expect(listClient).toContain('PAGE_SIZE,');
    expect(listClient).toContain('filterRecords(items, filters)');
  });

  it('keeps prerendered pages on real navigations', async () => {
    // `/{slug}/` and `/{slug}/page/N/` are documents, not states: page
    // 2's "Previous" link, "Clear all", and the header's own Browse
    // link all point at a different document. Adopting those in place
    // left page 2's records rendered under the page-1 URL. Only a URL
    // that carries a query — which no prerendered page has — is ours.
    const listClient = await readFile(
      resolve(
        import.meta.dirname,
        '../../registry/default/components/grove/directory-index-client.astro',
      ),
      'utf8',
    );

    // The rule lives in `canAdoptInPlace` (lib/live-filters.ts, unit
    // tested): a bare list URL is adopted only from page 1 of that list.
    expect(listClient).toContain(
      'if (!isListUrl || !canAdoptInPlace(url, location.pathname, routePage || 1)) return;',
    );
    // The skip link lives on this same path; a hash is never ours.
    expect(listClient).toContain('if (url.hash) return;');
    // Sort is a client view too: every `/page/N/` document is built
    // with the default sort.
    expect(listClient).toContain(
      'const isClientView = () => hasAnyFilter(filters) || Boolean(filters.sort);',
    );
  });

  it('recomputes facet intersection counts from the live query string', async () => {
    // The route is prerendered with global (unfiltered) counts; the
    // client must re-run buildFacets with the URL's filters and patch
    // the count spans in place (audit P0: counts stayed global under
    // an active filter).
    const listClient = await readFile(
      resolve(
        import.meta.dirname,
        '../../registry/default/components/grove/directory-index-client.astro',
      ),
      'utf8',
    );
    const filterOptions = await readFile(
      resolve(import.meta.dirname, '../../registry/default/components/grove/filter-options.astro'),
      'utf8',
    );

    expect(listClient).toContain('buildFacets,');
    expect(listClient).toContain('buildFacets(items, {');
    expect(listClient).toContain('querySelectorAll("[data-facet-count]")');
    expect(filterOptions).toContain('data-facet-count');
    expect(filterOptions).toContain('data-facet={filterKey}');
    expect(filterOptions).toContain('data-value={option.value}');
  });

  it('exposes filter popovers as groups of native inputs, never listboxes', async () => {
    // role="listbox" over label/input children has no valid a11y
    // tree; the popover is a group of native checkboxes/radios.
    const menu = await readFile(
      resolve(
        import.meta.dirname,
        '../../registry/default/components/grove/filter-group-menu.astro',
      ),
      'utf8',
    );
    expect(menu).not.toContain('role="listbox"');
    expect(menu).not.toContain('aria-haspopup="listbox"');
    expect(menu).toContain('role="group"');
    expect(menu).toContain('aria-expanded="false"');
  });

  it('announces theme changes with a stateful label and live region', async () => {
    const toggle = await readFile(
      resolve(import.meta.dirname, '../../registry/default/components/site/theme-toggle.astro'),
      'utf8',
    );
    expect(toggle).toContain('role="status"');
    expect(toggle).toContain('switch to');
    expect(toggle).toContain('setAttribute("aria-label"');
    expect(toggle).not.toContain('aria-label="Toggle theme"');
  });

  it('builds the mobile filter drawer on a native dialog', async () => {
    const drawer = await readFile(
      resolve(import.meta.dirname, '../../registry/default/components/ui/filter-drawer.astro'),
      'utf8',
    );
    expect(drawer).toContain('<dialog');
    expect(drawer).toContain('showModal()');
    expect(drawer).toContain('aria-haspopup="dialog"');
  });

  it('restores focus to the trigger when Escape closes a filter popover', async () => {
    const panel = await readFile(
      resolve(import.meta.dirname, '../../registry/default/components/grove/refine-panel.astro'),
      'utf8',
    );
    expect(panel).toContain('getAttribute("aria-expanded") === "true"');
    expect(panel).toContain('parts(openGroup).trigger?.focus()');
  });

  it('applies facet changes live, with no Apply step', async () => {
    const read = (path: string) =>
      readFile(resolve(import.meta.dirname, '../../registry/default/components', path), 'utf8');
    const [menu, panel, drawer, browse, listClient] = await Promise.all([
      read('grove/filter-group-menu.astro'),
      read('grove/refine-panel.astro'),
      read('ui/filter-drawer.astro'),
      read('grove/directory-browse-view.astro'),
      read('grove/directory-index-client.astro'),
    ]);

    // Every input navigates on change; there is no Apply button.
    expect(menu).not.toContain('grove-filter-apply');
    expect(panel).not.toContain('grove-filter-apply');
    expect(panel).toContain(
      'input.addEventListener("change", () => navigate(group, checkedValues(group)))',
    );
    // Popovers and the drawer report open/close so one filter session
    // becomes one history entry.
    expect(panel).toContain('"grove:filter-surface"');
    expect(drawer).toContain('"grove:filter-surface"');
    expect(listClient).toContain('new FilterHistorySession()');
    expect(listClient).toContain('adopt(url, session.modeForChange())');
    // The drawer's footer shows results; it does not apply them.
    expect(drawer).toContain('data-drawer-results');
    expect(browse).toContain('resultsTarget="#results-heading"');
    // The count is announced politely, and chips render in the panel too.
    expect(browse).toContain('aria-live="polite"');
    expect(browse.match(/data-active-filters/g)?.length).toBe(2);
    expect(listClient).toContain('querySelectorAll<HTMLElement>("[data-active-filters]")');
  });

  it('browses taxonomy pages with the same engine, scoped to the term', async () => {
    const read = (path: string) =>
      readFile(resolve(import.meta.dirname, '../../registry/default', path), 'utf8');
    const [browse, view, taxonomyList, listClient, stacks, categories, licenses] =
      await Promise.all([
        read('components/grove/directory-browse.astro'),
        read('components/grove/directory-browse-view.astro'),
        read('components/grove/taxonomy-list.astro'),
        read('components/grove/directory-index-client.astro'),
        read('pages/stacks/[name].astro'),
        read('pages/categories/[name].astro'),
        read('pages/licenses/[name].astro'),
      ]);

    // The directory renders the view without a scope.
    expect(browse).toContain('<DirectoryBrowseView routePage={routePage}>');
    // Taxonomy pages render it scoped, on their own path.
    expect(taxonomyList).toContain('<DirectoryBrowseView scope={scope} pathPrefix={pathPrefix} />');
    expect(stacks).toContain('scope={{ stacks: [name] }}');
    expect(stacks).toContain('pathPrefix={`/stacks/');
    expect(categories).toContain('scope={{ categories: [name] }}');
    expect(licenses).toContain('scope={{ licenses: [name] }}');
    // The scoped group is neither a facet nor a chip on the page.
    expect(view).toContain('!fixed.includes(group.filterKey');
    expect(view).toContain('const chips = scoped ? [] : model.chips;');
    // The client narrows the index to the scope once, strips the scope
    // from the URL's filters, and keeps reading data from the directory.
    expect(listClient).toContain(
      'items = scope ? filterRecords(all, scope as IndexFilters) : all;',
    );
    expect(listClient).toContain('withoutScope(filtersFromSearchParams(source), scope)');
    expect(listClient).toContain('const dataPrefix = `/');
  });

  it('uses generated taxonomy names as display labels', async () => {
    const recordsModule = await readFile(
      resolve(import.meta.dirname, 'server/directory.ts'),
      'utf8',
    );
    const models = await readFile(resolve(import.meta.dirname, 'server/models.ts'), 'utf8');

    expect(recordsModule).toContain('export function taxonomyLabel');
    expect(recordsModule).toContain('?? prettySlug(id)');
    expect(models).toMatch(/taxonomyLabel\(['"]categories['"]/);
    expect(models).toContain('getDirectoryIndexModel');
  });

  it('ships community and final call-to-action sections on the homepage', async () => {
    const homePage = await readFile(resolve(pagesDir, 'index.astro'), 'utf8');

    expect(homePage).toContain('<ContributorsGrid');
    expect(homePage).toContain('<FinalCta');
    expect(homePage).toContain('viewAllLabel="Meet the community"');
  });

  it('keeps submission controls responsive and taxonomy-labelled', async () => {
    const submitPage = await readFile(resolve(pagesDir, 'submit.astro'), 'utf8');
    const models = await readFile(resolve(import.meta.dirname, 'server/models.ts'), 'utf8');

    expect(models).toMatch(/taxonomyLabel\(['"]categories['"]/);
    expect(models).toContain('site.taxonomy?.stacks?.length');
    expect(models).not.toMatch(/return ['"]typescript['"]/);
    // Form and preview side by side on wide screens, the preview sticky.
    expect(submitPage).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]');
    expect(submitPage).toContain('lg:sticky lg:top-20');
  });

  it('keeps routes consumer-owned and package logic composable', async () => {
    const integration = await readFile(resolve(import.meta.dirname, 'index.ts'), 'utf8');
    const homePage = await readFile(resolve(pagesDir, 'index.astro'), 'utf8');
    const detailPage = await readFile(resolve(pagesDir, '[slug]/[recordSlug].astro'), 'utf8');

    expect(integration).not.toContain('injectRoute');
    expect(homePage).toContain('getHomePageModel(siteConfig)');
    expect(detailPage).toContain('getRecordDetailModel(');
  });
});
