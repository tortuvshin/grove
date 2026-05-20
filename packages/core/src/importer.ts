import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { parseAwesomeMarkdown, type ImportResult } from "./markdown.js";

function githubReadmeUrl(input: string): string | undefined {
  const match = input.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:\/)?$/i);
  if (!match) return undefined;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/HEAD/README.md`;
}

export async function importAwesomeList(input: string): Promise<ImportResult> {
  const remote = githubReadmeUrl(input) ?? (/^https?:\/\//.test(input) ? input : undefined);
  if (remote) {
    const response = await fetch(remote);
    if (!response.ok) {
      throw new Error(`Could not fetch ${remote}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return parseAwesomeMarkdown(text, { file: "sources/README.md", sourceUrl: input });
  }

  const path = resolve(input);
  const text = await readFile(path, "utf8");
  return parseAwesomeMarkdown(text, { file: basename(path) });
}
