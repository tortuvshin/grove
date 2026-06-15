/**
 * @grove-dev/ui — formatting helpers unit tests.
 *
 * Coverage:
 *   - formatRelative: 1 minute ago, 1 day, 30 days, 1 year,
 *     future (today), DST transition, leap year (Feb 29), invalid
 *     input, missing input
 *   - compact: < 1000 (plain), 1000-9999 (1k format with decimal),
 *     >= 10000 (no decimal)
 *   - formatStars: non-finite → null
 *   - formatNumber: thousands separator; non-finite → "—"
 *   - formatDate: invalid → original string
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { compact, formatStars, formatNumber, formatRelative, formatDate } from "./format.js";

describe("formatRelative — date math", () => {
  // Anchor the clock so the day math is deterministic.
  let now: Date;

  beforeEach(() => {
    now = new Date("2026-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '—' for null / undefined / empty / invalid input", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(undefined)).toBe("—");
    expect(formatRelative("")).toBe("—");
    expect(formatRelative("not a date")).toBe("—");
  });

  it("returns 'today' for a future date (defensive: bad upstream timestamps)", () => {
    // Days = floor((now - future) / 1d) — when the date is in
    // the future, days is negative, and the `days <= 0` branch
    // returns "today" instead of an "X days from now" string.
    // Pinning this — it shows up in practice with server clock
    // skew.
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(future)).toBe("today");
  });

  it("returns '1d ago' for 1 day ago", () => {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(oneDayAgo)).toBe("1d ago");
  });

  it("returns 'Nd ago' for N days (29, 28, etc.)", () => {
    const days29 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(days29)).toBe("29d ago");
  });

  it("returns '1mo ago' at the 30-day mark", () => {
    const oneMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(oneMonth)).toBe("1mo ago");
  });

  it("returns '1y ago' at the 12-month mark", () => {
    // 12 * 30 = 360 days. Math.floor(360/30) = 12 months, then
    // Math.floor(12/12) = 1 year.
    const oneYear = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(oneYear)).toBe("1y ago");
  });

  it("returns '2y ago' for ~24 months", () => {
    const twoYears = new Date(now.getTime() - 720 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(twoYears)).toBe("2y ago");
  });

  it("DST spring-forward: a US Eastern time date is parsed and produces a sane delta", () => {
    // 2026-03-08 is the US spring-forward day (EST→EDT). A date
    // at 2026-03-08 06:00 UTC is 02:00 EDT (after the jump).
    // The test: from 2026-06-15 (now), that's about 99 days
    // ago, which should land in the "Nmo ago" branch.
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    const dst = "2026-03-08T06:00:00Z";
    const out = formatRelative(dst);
    // 99 days / 30 = 3 months, no year crossing.
    expect(out).toBe("3mo ago");
  });

  it("DST fall-back: a US Eastern time date across the fall transition", () => {
    // 2026-11-01 is the US fall-back day (EDT→EST). A date at
    // 2026-11-01 05:30 UTC is 01:30 EDT (before the fall-back
    // happens at 06:00 UTC / 02:00 local). From 2026-12-01, that's
    // 30 days → "1mo ago".
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    const dst = "2026-11-01T05:30:00Z";
    expect(formatRelative(dst)).toBe("1mo ago");
  });

  it("leap year: a Feb 29, 2024 date is parsed correctly (no 'Invalid Date')", () => {
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    // 2024 was a leap year. Feb 29, 2024 → from 2026-06-15
    // that's about 837 days, which is 27 months / 2 years.
    const leap = "2024-02-29T12:00:00Z";
    const out = formatRelative(leap);
    // The exact string is "2y ago" because 27 months / 12 = 2.
    expect(out).toBe("2y ago");
  });

  it("1 minute ago: floors to 0 days, returns 'today'", () => {
    // The function floors to days — 1 minute ago is < 1 day,
    // so the `days <= 0` branch returns "today", not
    // "1 minute ago". Pin the actual behaviour so a future
    // "sub-day resolution" change is visible.
    const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(formatRelative(oneMinAgo)).toBe("today");
  });
});

describe("compact", () => {
  it("returns the plain number for values < 1000", () => {
    expect(compact(0)).toBe("0");
    expect(compact(79)).toBe("79");
    expect(compact(999)).toBe("999");
  });

  it("formats values 1000-9999 with one decimal (1.2k style)", () => {
    expect(compact(1000)).toBe("1.0k");
    expect(compact(1234)).toBe("1.2k");
    expect(compact(9999)).toBe("10.0k");
  });

  it("formats values >= 10000 with no decimal (rounded k)", () => {
    expect(compact(10000)).toBe("10k");
    expect(compact(12345)).toBe("12k");
    expect(compact(99999)).toBe("100k");
  });
});

describe("formatStars", () => {
  it("returns the compact-formatted string for finite numbers", () => {
    expect(formatStars(500)).toBe("500");
    expect(formatStars(1500)).toBe("1.5k");
  });

  it("returns null for non-finite input (caller can render '—')", () => {
    expect(formatStars(null)).toBeNull();
    expect(formatStars(undefined)).toBeNull();
    expect(formatStars(Number.NaN)).toBeNull();
    expect(formatStars(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("formatNumber", () => {
  it("formats finite numbers with thousands separators (en-US)", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1_000_000)).toBe("1,000,000");
  });

  it("returns '—' for non-finite or nullish input", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date as 'Mon DD, YYYY' (en-US)", () => {
    expect(formatDate("2026-01-05T00:00:00Z")).toBe("Jan 5, 2026");
  });

  it("returns '—' for null / undefined / empty input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("returns the original string for unparseable input (so the UI shows the broken value, not '—')", () => {
    // Pin the asymmetry: a present-but-invalid value falls
    // through (return the original) so curators can spot the
    // bad data; a missing value returns "—".
    expect(formatDate("not a date")).toBe("not a date");
  });
});
