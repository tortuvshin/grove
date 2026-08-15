import { describe, expect, it } from 'vitest';
import {
  labelDisplay,
  langColor,
  lensDisplay,
  LICENSE_NOT_DETECTED,
  licenseDisplay,
  nameInitials,
  prettySlug,
  sortDisplay,
  statusDisplay,
} from './directory-display.js';

describe('labelDisplay', () => {
  it('returns the display name for known labels', () => {
    expect(labelDisplay('hot')).toBe('Trending');
    expect(labelDisplay('mature')).toBe('Established');
    expect(labelDisplay('new')).toBe('Recently added');
    expect(labelDisplay('featured')).toBe('Featured');
  });

  it('returns null for unknown or missing labels', () => {
    expect(labelDisplay('unknown')).toBeNull();
    expect(labelDisplay(null)).toBeNull();
    expect(labelDisplay(undefined)).toBeNull();
    expect(labelDisplay('')).toBeNull();
  });
});

describe('statusDisplay', () => {
  it('returns the display name for known statuses', () => {
    expect(statusDisplay('active')).toBe('Active');
    expect(statusDisplay('archived')).toBe('Archived');
    expect(statusDisplay('needs-maintainer')).toBe('Needs maintainer');
  });

  it("falls back to 'Unknown' for missing or unknown statuses", () => {
    expect(statusDisplay('not-a-status')).toBe('Unknown');
    expect(statusDisplay(null)).toBe('Unknown');
  });
});

describe('lensDisplay', () => {
  it('returns the display name for known lens ids', () => {
    expect(lensDisplay('all')).toBe('All items');
    expect(lensDisplay('good-to-learn')).toBe('Good to learn');
    expect(lensDisplay('production-like')).toBe('Production-like');
  });

  it('falls back to the id when unknown (audit trail: lens ids are added faster than display labels)', () => {
    expect(lensDisplay('not-a-lens')).toBe('not-a-lens');
  });

  it("returns the default 'all' lens label for null/undefined", () => {
    expect(lensDisplay(null)).toBe('All items');
    expect(lensDisplay(undefined)).toBe('All items');
  });
});

describe('sortDisplay', () => {
  it('returns the display name for known sort ids', () => {
    expect(sortDisplay('recently-updated')).toBe('Recently updated');
    expect(sortDisplay('most-starred')).toBe('Most starred');
  });

  it('falls back to the id when unknown', () => {
    expect(sortDisplay('not-a-sort')).toBe('not-a-sort');
  });

  it('returns the default sort for null/undefined', () => {
    expect(sortDisplay(null)).toBe('Recently updated');
    expect(sortDisplay(undefined)).toBe('Recently updated');
  });
});

describe('prettySlug', () => {
  it('converts kebab-case to Title Case', () => {
    expect(prettySlug('hello-world')).toBe('Hello World');
  });

  it('handles underscores as separators', () => {
    expect(prettySlug('hello_world')).toBe('Hello World');
  });

  it('collapses multiple separators', () => {
    expect(prettySlug('hello--world__foo')).toBe('Hello World Foo');
  });

  it('returns empty string for missing values', () => {
    expect(prettySlug(null)).toBe('');
    expect(prettySlug(undefined)).toBe('');
  });
});

describe('langColor', () => {
  it('returns the Linguist palette color for known languages', () => {
    expect(langColor('TypeScript')).toBe('#3178c6');
    expect(langColor('Python')).toBe('#3572A5');
  });

  it('returns a neutral grey for unknown or missing languages', () => {
    expect(langColor('COBOL')).toBe('#9ca3af');
    expect(langColor(null)).toBe('#9ca3af');
    expect(langColor(undefined)).toBe('#9ca3af');
  });
});

describe('licenseDisplay', () => {
  it('returns known SPDX ids untouched', () => {
    expect(licenseDisplay('MIT')).toBe('MIT');
    expect(licenseDisplay('Apache-2.0')).toBe('Apache-2.0');
    expect(licenseDisplay('GPL-3.0')).toBe('GPL-3.0');
  });

  it("replaces NOASSERTION with 'License not detected'", () => {
    expect(licenseDisplay('NOASSERTION')).toBe(LICENSE_NOT_DETECTED);
    expect(licenseDisplay('noassertion')).toBe(LICENSE_NOT_DETECTED);
  });

  it("replaces OTHER with 'Other'", () => {
    expect(licenseDisplay('OTHER')).toBe('Other');
  });

  it("replaces NONE and UNLICENSED with 'License not detected'", () => {
    expect(licenseDisplay('NONE')).toBe(LICENSE_NOT_DETECTED);
    expect(licenseDisplay('UNLICENSED')).toBe(LICENSE_NOT_DETECTED);
  });

  it("returns 'License not detected' for empty string and null", () => {
    expect(licenseDisplay('')).toBe(LICENSE_NOT_DETECTED);
    expect(licenseDisplay(null)).toBe(LICENSE_NOT_DETECTED);
    expect(licenseDisplay(undefined)).toBe(LICENSE_NOT_DETECTED);
  });

  it('is case-insensitive for placeholder lookup', () => {
    expect(licenseDisplay('NoAssertion')).toBe(LICENSE_NOT_DETECTED);
    expect(licenseDisplay('none')).toBe(LICENSE_NOT_DETECTED);
  });
});

describe('nameInitials', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(nameInitials('Open WebUI')).toBe('OW');
    expect(nameInitials('ollama')).toBe('O');
    expect(nameInitials('a b c')).toBe('AB');
  });

  it('handles empty, null, and whitespace-only input', () => {
    expect(nameInitials('')).toBe('');
    expect(nameInitials(null)).toBe('');
    expect(nameInitials(undefined)).toBe('');
    expect(nameInitials('   ')).toBe('');
  });
});
