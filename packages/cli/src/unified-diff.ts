// SPDX-License-Identifier: MIT
/**
 * A minimal unified diff, used by `grove update --diff` to show what an
 * upstream change would do to a file before it is applied.
 *
 * The CLI has no diff dependency and does not want one for this: the
 * inputs are two versions of one source file, always small enough that a
 * plain longest-common-subsequence table is the right trade.
 */

const CONTEXT = 3;

/**
 * Longest common subsequence of two line arrays, as `[oldIndex, newIndex]`
 * pairs. The DP table is a flat Int32Array — `(a.length + 1) * (b.length + 1)`
 * counts of the LCS from each position onward.
 */
function commonSubsequence(a: string[], b: string[]): Array<[number, number]> {
  const width = b.length + 1;
  const lengths = new Int32Array((a.length + 1) * width);
  // `noUncheckedIndexedAccess` types every index read as possibly
  // undefined, including typed arrays; every read here is in range.
  const lcs = (i: number, j: number): number => lengths[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[i] === b[j] ? lcs(i + 1, j + 1) + 1 : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (lcs(i + 1, j) >= lcs(i, j + 1)) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

interface Edit {
  kind: ' ' | '-' | '+';
  text: string;
  /** 1-based line number in the old file, when the line exists there. */
  oldLine?: number;
  /** 1-based line number in the new file, when the line exists there. */
  newLine?: number;
}

function editScript(a: string[], b: string[]): Edit[] {
  const edits: Edit[] = [];
  let i = 0;
  let j = 0;
  for (const [ai, bj] of commonSubsequence(a, b)) {
    while (i < ai) edits.push({ kind: '-', text: a[i] ?? '', oldLine: ++i });
    while (j < bj) edits.push({ kind: '+', text: b[j] ?? '', newLine: ++j });
    edits.push({ kind: ' ', text: a[ai] ?? '', oldLine: ++i, newLine: ++j });
  }
  while (i < a.length) edits.push({ kind: '-', text: a[i] ?? '', oldLine: ++i });
  while (j < b.length) edits.push({ kind: '+', text: b[j] ?? '', newLine: ++j });
  return edits;
}

/**
 * Render a unified diff of `before` → `after`. Returns an empty string
 * when the two are identical, so callers can skip a file with one check.
 */
export function unifiedDiff(before: string, after: string, label: string): string {
  if (before === after) return '';
  const edits = editScript(before.split('\n'), after.split('\n'));

  // Keep every changed line plus CONTEXT unchanged lines either side;
  // consecutive kept runs become hunks.
  const keep = new Array<boolean>(edits.length).fill(false);
  for (let index = 0; index < edits.length; index++) {
    if (edits[index]?.kind === ' ') continue;
    const from = Math.max(0, index - CONTEXT);
    const to = Math.min(edits.length - 1, index + CONTEXT);
    for (let k = from; k <= to; k++) keep[k] = true;
  }

  const lines: string[] = [`--- a/${label}`, `+++ b/${label}`];
  let index = 0;
  while (index < edits.length) {
    if (!keep[index]) {
      index++;
      continue;
    }
    const start = index;
    while (index < edits.length && keep[index]) index++;
    const hunk = edits.slice(start, index);
    const oldStart = hunk.find((edit) => edit.oldLine !== undefined)?.oldLine ?? 0;
    const newStart = hunk.find((edit) => edit.newLine !== undefined)?.newLine ?? 0;
    const oldCount = hunk.filter((edit) => edit.kind !== '+').length;
    const newCount = hunk.filter((edit) => edit.kind !== '-').length;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const edit of hunk) lines.push(`${edit.kind}${edit.text}`);
  }
  return lines.join('\n');
}
