import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canAdoptInPlace,
  countLabel,
  debounce,
  FilterHistorySession,
  focusIndexAfterRender,
  hrefForGroupSelection,
  resultsAnnouncement,
  scopedGroups,
  searchWithoutScope,
  showResultsLabel,
  withoutScope,
} from './live-filters.ts';

describe('hrefForGroupSelection', () => {
  it('writes the group as repeated keys and keeps every other parameter', () => {
    expect(
      hrefForGroupSelection('?q=notes&stack=go&sort=most-starred', '/apps', 'category', [
        'editor',
        'wiki',
      ]),
    ).toBe('/apps?q=notes&stack=go&sort=most-starred&category=editor&category=wiki');
  });

  it('replaces the previous selection of that group', () => {
    expect(hrefForGroupSelection('?category=old&stack=go', '/apps', 'category', ['new'])).toBe(
      '/apps?stack=go&category=new',
    );
  });

  it('drops the page, since a new result set starts on page 1', () => {
    expect(hrefForGroupSelection('?stack=go&page=3', '/apps', 'stack', ['go', 'rust'])).toBe(
      '/apps?stack=go&stack=rust',
    );
  });

  it('clearing the only filter returns the bare list path', () => {
    expect(hrefForGroupSelection('?license=mit&page=2', '/apps', 'license', [])).toBe('/apps');
  });

  it('clearing one group keeps the others', () => {
    expect(hrefForGroupSelection('?license=mit&stack=go', '/apps', 'stack', [])).toBe(
      '/apps?license=mit',
    );
  });

  it('ignores empty values', () => {
    expect(hrefForGroupSelection('', '/apps', 'tag', ['', 'cli'])).toBe('/apps?tag=cli');
  });

  it('accepts a search string without the leading question mark', () => {
    expect(hrefForGroupSelection('q=x', '/apps', 'tag', ['cli'])).toBe('/apps?q=x&tag=cli');
  });
});

describe('canAdoptInPlace', () => {
  const url = (href: string) => new URL(href, 'https://example.test');

  it('adopts any URL that carries a query', () => {
    expect(canAdoptInPlace(url('/apps?tag=cli'), '/apps/', 1)).toBe(true);
    expect(canAdoptInPlace(url('/apps?tag=cli'), '/apps/page/2/', 2)).toBe(true);
  });

  it('clears to the bare list in place on page 1, with or without a trailing slash', () => {
    expect(canAdoptInPlace(url('/apps'), '/apps/', 1)).toBe(true);
    expect(canAdoptInPlace(url('/apps/'), '/apps', 1)).toBe(true);
  });

  it('really navigates to the bare list from a prerendered page 2+', () => {
    expect(canAdoptInPlace(url('/apps/'), '/apps/page/2/', 2)).toBe(false);
    expect(canAdoptInPlace(url('/apps/'), '/apps/', 2)).toBe(false);
  });

  it('really navigates to a different prerendered document', () => {
    expect(canAdoptInPlace(url('/apps/page/3/'), '/apps/', 1)).toBe(false);
  });
});

describe('FilterHistorySession', () => {
  const at = (url: string, scrollY = 0) => ({ url, scrollY });

  it('pushes when no filter surface is open', () => {
    const session = new FilterHistorySession();
    expect(session.active).toBe(false);
    expect(session.modeForChange()).toBe('push');
  });

  it('replaces while a surface is open, then commits one push on close', () => {
    const session = new FilterHistorySession();
    session.open('stack', at('/apps?q=x', 120));
    expect(session.active).toBe(true);
    expect(session.modeForChange()).toBe('replace');
    expect(session.close('stack', '/apps?q=x&stack=go&stack=rust')).toEqual({
      start: { url: '/apps?q=x', scrollY: 120 },
      end: '/apps?q=x&stack=go&stack=rust',
    });
    expect(session.active).toBe(false);
    expect(session.modeForChange()).toBe('push');
  });

  it('commits nothing when the URL ended where it started', () => {
    const session = new FilterHistorySession();
    session.open('stack', at('/apps?stack=go'));
    expect(session.close('stack', '/apps?stack=go')).toBeNull();
  });

  it('treats a trailing slash on the path as the same URL', () => {
    const session = new FilterHistorySession();
    session.open('drawer', at('/apps/'));
    expect(session.close('drawer', '/apps')).toBeNull();
  });

  it('keeps nested surfaces in one session until the last one closes', () => {
    const session = new FilterHistorySession();
    session.open('drawer', at('/apps'));
    session.open('category', at('/apps?ignored=1'));
    expect(session.close('category', '/apps?category=wiki')).toBeNull();
    expect(session.modeForChange()).toBe('replace');
    expect(session.close('drawer', '/apps?category=wiki&tag=cli')).toEqual({
      start: { url: '/apps', scrollY: 0 },
      end: '/apps?category=wiki&tag=cli',
    });
  });

  it('ignores a close for a surface that never opened', () => {
    const session = new FilterHistorySession();
    expect(session.close('stack', '/apps?stack=go')).toBeNull();
    session.open('drawer', at('/apps'));
    expect(session.close('stack', '/apps?stack=go')).toBeNull();
    expect(session.active).toBe(true);
  });

  it('opening the same surface twice needs only one close', () => {
    const session = new FilterHistorySession();
    session.open('stack', at('/apps'));
    session.open('stack', at('/apps'));
    expect(session.close('stack', '/apps?stack=go')).not.toBeNull();
  });

  it('rebase moves the starting point after Back/Forward during a session', () => {
    const session = new FilterHistorySession();
    session.open('drawer', at('/apps?stack=go'));
    session.rebase(at('/apps?q=older', 40));
    expect(session.modeForChange()).toBe('replace');
    expect(session.close('drawer', '/apps?q=older&tag=cli')).toEqual({
      start: { url: '/apps?q=older', scrollY: 40 },
      end: '/apps?q=older&tag=cli',
    });
  });

  it('rebase does nothing when no session is open', () => {
    const session = new FilterHistorySession();
    session.rebase(at('/apps?q=x'));
    expect(session.active).toBe(false);
    session.open('stack', at('/apps'));
    expect(session.close('stack', '/apps')).toBeNull();
  });
});

describe('labels', () => {
  it('pluralises the count', () => {
    expect(countLabel(0, 'app', 'apps')).toBe('0 apps');
    expect(countLabel(1, 'app', 'apps')).toBe('1 app');
    expect(countLabel(12, 'app', 'apps')).toBe('12 apps');
  });

  it('announces a whole sentence, including zero results', () => {
    expect(resultsAnnouncement(12, 'app', 'apps')).toBe('12 apps found.');
    expect(resultsAnnouncement(1, 'app', 'apps')).toBe('1 app found.');
    expect(resultsAnnouncement(0, 'app', 'apps')).toBe('No apps match these filters.');
  });

  it('labels the drawer button as showing results, not applying them', () => {
    expect(showResultsLabel(12, 'app', 'apps')).toBe('Show 12 apps');
    expect(showResultsLabel(1, 'app', 'apps')).toBe('Show 1 app');
    expect(showResultsLabel(0, 'app', 'apps')).toBe('No apps match');
    expect(showResultsLabel(12, 'app', 'apps', true)).toBe('Updating results…');
    for (const label of [showResultsLabel(3, 'app', 'apps'), showResultsLabel(0, 'app', 'apps')]) {
      expect(label).not.toMatch(/apply/i);
    }
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once, with the last arguments, after rapid calls settle', () => {
    const spy = vi.fn();
    const announce = debounce(spy, 500);
    announce('1 app found.');
    vi.advanceTimersByTime(200);
    announce('2 apps found.');
    vi.advanceTimersByTime(200);
    announce('3 apps found.');
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('3 apps found.');
  });

  it('cancel drops a pending call', () => {
    const spy = vi.fn();
    const announce = debounce(spy, 500);
    announce('x');
    announce.cancel();
    vi.advanceTimersByTime(1000);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('focusIndexAfterRender', () => {
  it('moves focus to the item that took the old one’s place', () => {
    expect(focusIndexAfterRender(1, 3)).toBe(1);
  });

  it('falls back to the new last item when the old index is past the end', () => {
    expect(focusIndexAfterRender(3, 3)).toBe(2);
  });

  it('returns -1 when nothing is left to focus', () => {
    expect(focusIndexAfterRender(0, 0)).toBe(-1);
  });

  it('clamps a negative index to the first item', () => {
    expect(focusIndexAfterRender(-1, 2)).toBe(0);
  });
});

describe('scope', () => {
  // Same table as core's DIRECTORY_FILTER_KEYS.
  const keys = {
    stacks: 'stack',
    platforms: 'platform',
    categories: 'category',
    tags: 'tag',
    licenses: 'license',
  };

  it('lists only the groups that carry values', () => {
    expect(scopedGroups({ stacks: ['flutter'], categories: [] })).toEqual(['stacks']);
    expect(scopedGroups(undefined)).toEqual([]);
    expect(scopedGroups(null)).toEqual([]);
  });

  it('removes the scoped group from URL filters and keeps the rest', () => {
    const filters = { q: 'notes', stacks: ['react'], platforms: ['android'] };
    expect(withoutScope(filters, { stacks: ['flutter'] })).toEqual({
      q: 'notes',
      platforms: ['android'],
    });
    // The input is not mutated.
    expect(filters.stacks).toEqual(['react']);
  });

  it('returns the same filters when there is no scope', () => {
    const filters = { stacks: ['go'] };
    expect(withoutScope(filters, undefined)).toBe(filters);
    expect(withoutScope(filters, {})).toBe(filters);
  });

  it('strips scoped parameters from a query string', () => {
    expect(
      searchWithoutScope('?stack=react&platform=android&stack=go', { stacks: ['flutter'] }, keys),
    ).toBe('?platform=android');
    expect(searchWithoutScope('?category=games', { categories: ['games'] }, keys)).toBe('');
  });

  it('reports no change when the query has no scoped parameter', () => {
    expect(searchWithoutScope('?platform=android', { stacks: ['flutter'] }, keys)).toBeNull();
    expect(searchWithoutScope('?stack=go', undefined, keys)).toBeNull();
  });
});
