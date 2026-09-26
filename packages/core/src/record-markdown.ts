/**
 * Codemod one YAML record into a Markdown record: YAML frontmatter
 * followed by the record's review body. `grove migrate markdown-records`
 * runs it over a whole site; the normalizer
 * (`loadNormalizedRecords`) must read the result back to the same
 * record, and {@link yamlRecordToMarkdown} refuses rather than write a
 * file it would not.
 *
 * Every field is kept except the three the normalizer derives
 * identically for a Markdown record:
 *
 *   - `slug`, when it equals the file name (the file name is the slug);
 *   - `kind`, when it equals the blueprint's kind (filled in on read);
 *   - `content`, the pointer (a Markdown record is its own body).
 *
 * Each top-level field keeps its own text: its value, style, quoting
 * and any `#` comments directly above it move with it. Only the order
 * of the fields changes, to {@link MARKDOWN_RECORD_FIELD_ORDER}.
 */

import { parseDocument, parse as parseYaml } from 'yaml';
import { splitFrontmatter } from './content-body.js';

/**
 * Frontmatter field order. What a contributor writes comes first (what
 * it is, what it runs on, where to get it, why it is listed), then the
 * reviewer's fields. A field not listed here keeps its original
 * relative order, after the contributor fields and before the reviewer
 * ones.
 */
export const MARKDOWN_RECORD_FIELD_ORDER = {
  contributor: [
    'name',
    'title',
    'repoUrl',
    'projectType',
    'type',
    'category',
    'topic',
    'stack',
    'stacks',
    'summary',
    'description',
    'sourceDescription',
    'platforms',
    'licenses',
    'links',
    'distribution',
    'logoUrl',
    'screenshots',
    'tags',
    'bestFor',
    'whyListed',
    'caveats',
    'difficulty',
    'codebaseSize',
    'author',
    'publishedAt',
    'founded',
    'location',
    'members',
    'parent',
    'related',
    'relations',
    'seo',
    'addedAt',
  ],
  reviewer: ['source', 'curation', 'scores', 'visibility'],
} as const;

/** Generated layers `grove migrate github-cache` moves out first. */
const GENERATED_KEYS = ['github', 'health'] as const;

export interface YamlRecordToMarkdownOptions {
  /**
   * The kind the blueprint gives every record (`project`, `resource`,
   * `entity`); a `kind:` with this value is dropped.
   */
  kind?: string;
  /**
   * The field that marks frontmatter as a record: `name`, or `title` on
   * a resource hub. The loader ignores a Markdown file without it, so a
   * record without it is refused.
   */
  labelKey?: string;
  /**
   * The record's review body, verbatim, without frontmatter. Omitted or
   * `''` for a record with no body.
   */
  body?: string;
}

export type YamlRecordToMarkdownResult =
  | {
      ok: true;
      /** The Markdown record: `---`, frontmatter, `---`, then the body byte-for-byte. */
      text: string;
      /** Top-level fields left out because the normalizer derives them. */
      dropped: string[];
    }
  | {
      ok: false;
      /** Why the record cannot be converted as it stands. */
      reason: string;
    };

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * JSON with the top level sorted: the frontmatter reorders top-level
 * fields on purpose, but everything below them (a `links` map, the
 * order of `distribution.channels`) must come back exactly as it was.
 */
function topLevelSorted(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .map((key) => [key, value[key]]),
  );
}

function rank(key: string, index: number): [number, number] {
  const contributor = (MARKDOWN_RECORD_FIELD_ORDER.contributor as readonly string[]).indexOf(key);
  if (contributor >= 0) return [0, contributor];
  const reviewer = (MARKDOWN_RECORD_FIELD_ORDER.reviewer as readonly string[]).indexOf(key);
  if (reviewer >= 0) return [2, reviewer];
  return [1, index];
}

function sortFields<T extends { key: string; index: number }>(fields: T[]): T[] {
  return [...fields].sort((a, b) => {
    const [groupA, orderA] = rank(a.key, a.index);
    const [groupB, orderB] = rank(b.key, b.index);
    return groupA - groupB || orderA - orderB;
  });
}

/** Offset of the start of the line containing `offset`. */
function lineStart(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

/**
 * Reorder a block mapping's top-level fields by moving text: each field
 * runs from its key line (plus the `#` comment lines directly above it)
 * to the next field. Returns `undefined` when the text is not a plain
 * block mapping this can cut safely.
 */
function reorderByText(text: string, drop: ReadonlySet<string>): string | undefined {
  const doc = parseDocument(text, { schema: 'core' });
  const contents = doc.contents as { items?: unknown[] } | null;
  if (!contents || !Array.isArray(contents.items)) return undefined;
  const fields: Array<{ key: string; index: number; start: number }> = [];
  for (const [index, item] of contents.items.entries()) {
    const keyNode = (item as { key?: { value?: unknown; range?: [number, number, number] } }).key;
    const key = keyNode?.value;
    const at = keyNode?.range?.[0];
    if (typeof key !== 'string' || at === undefined) return undefined;
    let start = lineStart(text, at);
    // A key not at column zero means a flow mapping or odd layout.
    if (start !== at) return undefined;
    // Comment lines directly above a field belong to it.
    while (start > 0) {
      const previous = lineStart(text, start - 1);
      if (!text.slice(previous, start).startsWith('#')) break;
      start = previous;
    }
    fields.push({ key, index, start });
  }
  if (fields.length === 0) return undefined;
  // Leading comments that no field claimed (a file header) stay on top;
  // a `---` document marker or directive does not.
  const preamble = text
    .slice(0, fields[0]?.start ?? 0)
    .split('\n')
    .filter((line) => line.startsWith('#'))
    .map((line) => `${line}\n`)
    .join('');
  const blocks = fields.map((field, i) => {
    const end = fields[i + 1]?.start ?? text.length;
    // Blank lines between fields are dropped; each block ends in one newline.
    const block = text.slice(field.start, end).replace(/\s+$/, '');
    return { ...field, block: `${block}\n` };
  });
  return (
    preamble +
    sortFields(blocks.filter((block) => !drop.has(block.key)))
      .map((block) => block.block)
      .join('')
  );
}

/** Reorder through the YAML document model; loses nothing but layout. */
function reorderByDocument(text: string, drop: ReadonlySet<string>): string | undefined {
  const doc = parseDocument(text, { schema: 'core' });
  const contents = doc.contents as { items?: unknown[]; flow?: boolean } | null;
  if (!contents || !Array.isArray(contents.items)) return undefined;
  contents.flow = false;
  const items = contents.items.map((item, index) => ({
    item,
    index,
    key: String((item as { key?: { value?: unknown } }).key?.value ?? ''),
  }));
  contents.items = sortFields(items.filter((entry) => !drop.has(entry.key))).map(
    (entry) => entry.item,
  );
  const out = doc.toString({ lineWidth: 0 });
  return out.startsWith('---\n') ? out.slice(4) : out;
}

/**
 * Turn one YAML record's text (and its body) into a Markdown record.
 * Refuses, with a reason, a record that is not a YAML mapping, still
 * carries inline `github`/`health`, has no `labelKey`, or would not
 * read back as the same fields and the same body.
 */
export function yamlRecordToMarkdown(
  slug: string,
  yamlText: string,
  options: YamlRecordToMarkdownOptions = {},
): YamlRecordToMarkdownResult {
  const labelKey = options.labelKey ?? 'name';
  const body = options.body ?? '';
  const text = yamlText.replace(/\r\n/g, '\n');
  let data: unknown;
  try {
    data = parseYaml(text, { schema: 'core' });
  } catch (err) {
    return { ok: false, reason: `YAML does not parse: ${(err as Error).message}` };
  }
  if (!isMapping(data)) return { ok: false, reason: 'record file is empty or not a YAML mapping' };
  const generated = GENERATED_KEYS.filter((key) => data[key] !== undefined);
  if (generated.length > 0) {
    return {
      ok: false,
      reason: `carries inline ${generated.join('/')}; run \`grove migrate github-cache\` first`,
    };
  }
  if (data[labelKey] === undefined) {
    return {
      ok: false,
      reason: `has no \`${labelKey}\`, so a Markdown file would not be a record`,
    };
  }

  const dropped: string[] = [];
  if (data.content !== undefined) dropped.push('content');
  if (data.slug === slug) dropped.push('slug');
  if (options.kind !== undefined && data.kind === options.kind) dropped.push('kind');
  const drop = new Set(dropped);
  const expected: Record<string, unknown> = { ...data };
  for (const key of dropped) delete expected[key];

  // Accept a frontmatter only if the loader reads it back as exactly
  // these fields and this body.
  const readsBack = (frontmatter: string | undefined): string | undefined => {
    if (frontmatter === undefined) return undefined;
    const candidate = `---\n${frontmatter}---\n${body}`;
    const split = splitFrontmatter(candidate);
    if (!split.hasFrontmatter || split.body !== body) return undefined;
    let parsed: unknown;
    try {
      parsed = parseYaml(split.frontmatter, { schema: 'core' });
    } catch {
      return undefined;
    }
    if (!isMapping(parsed) || topLevelSorted(parsed) !== topLevelSorted(expected)) {
      return undefined;
    }
    return candidate;
  };

  const out = readsBack(reorderByText(text, drop)) ?? readsBack(reorderByDocument(text, drop));
  if (out === undefined) {
    return {
      ok: false,
      reason:
        'the Markdown file would not read back as the same record (frontmatter over 198 lines, a `---` line inside a value, or a body with CRLF line endings)',
    };
  }
  return { ok: true, text: out, dropped };
}
