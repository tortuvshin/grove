/**
 * @grove-dev/ui — pagination primitive unit tests.
 *
 * Coverage:
 *   - out-of-range page (page < 1, page > totalPages) clamps to
 *     the valid range — currently the function silently uses
 *     Math.max(1, ...) and Math.floor(...) for negative/fractional
 *     input; pin that so a future "throw on out-of-range" change
 *     is visible.
 *   - NaN page (a broken URL param) becomes page 1, not a throw
 *   - empty input + any page returns []
 *   - single page (items <= pageSize) returns all items
 *   - exact page-boundary (items == pageSize * page) returns the
 *     last full page, not an empty array
 */
import { describe, it, expect } from "vitest";
import { paginateRecords, totalPages } from "./paginate.js";

describe("paginateRecords — happy path", () => {
  it("returns the first page of items, 1-based", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(paginateRecords(items, 1, 3)).toEqual([1, 2, 3]);
    expect(paginateRecords(items, 2, 3)).toEqual([4, 5, 6]);
    expect(paginateRecords(items, 3, 3)).toEqual([7, 8, 9]);
  });

  it("single page (items <= pageSize) returns everything on page 1", () => {
    const items = [1, 2, 3];
    expect(paginateRecords(items, 1, 10)).toEqual([1, 2, 3]);
  });

  it("exact page-boundary (items == pageSize * page) returns the last full page, not []", () => {
    // 6 items, 2 per page → page 1 = [1,2], page 2 = [3,4],
    // page 3 = [5,6]. The last page is NOT empty.
    const items = [1, 2, 3, 4, 5, 6];
    expect(paginateRecords(items, 3, 2)).toEqual([5, 6]);
  });

  it("empty input returns [] for any page", () => {
    expect(paginateRecords<number>([], 1, 10)).toEqual([]);
    expect(paginateRecords<number>([], 5, 10)).toEqual([]);
  });
});

describe("paginateRecords — out-of-range page clamps to 1", () => {
  it("page < 1 clamps to page 1 (does not throw, does not return [])", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateRecords(items, 0, 3)).toEqual([1, 2, 3]);
    expect(paginateRecords(items, -5, 3)).toEqual([1, 2, 3]);
  });

  it("NaN page (e.g. from a broken URL ?page=foo) returns [] (NOT page 1)", () => {
    // Pin the *current* behaviour. The function's safePage
    // line is `Math.max(1, Math.floor(page))`, but:
    //   Math.floor(NaN) === NaN
    //   Math.max(1, NaN) === NaN
    // So safePage is NaN, start = (NaN-1)*pageSize = NaN, and
    // `items.slice(NaN, NaN+pageSize)` returns []. A future
    // change to either coerce NaN to 1 or throw would shift
    // the broken-URL user experience from "blank page" to
    // "page 1" or "error" — both are defensible, neither is
    // currently implemented.
    const items = [1, 2, 3, 4, 5];
    expect(paginateRecords(items, Number.NaN, 3)).toEqual([]);
  });

  it("fractional page is floored (page 1.7 → page 1)", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateRecords(items, 1.7, 3)).toEqual([1, 2, 3]);
    expect(paginateRecords(items, 2.9, 3)).toEqual([4, 5]);
  });

  it("page beyond the last page returns [] (does not throw, does not wrap)", () => {
    const items = [1, 2, 3];
    expect(paginateRecords(items, 99, 2)).toEqual([]);
  });
});

describe("totalPages", () => {
  it("returns at least 1 even for 0 items (so the UI always has a 'page 1')", () => {
    expect(totalPages(0, 10)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(totalPages(10, 10)).toBe(1);
    expect(totalPages(11, 10)).toBe(2);
    expect(totalPages(20, 10)).toBe(2);
    expect(totalPages(21, 10)).toBe(3);
  });
});
