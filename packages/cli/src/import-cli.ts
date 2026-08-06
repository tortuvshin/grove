import { Command } from "commander";
import { resolve } from "node:path";
import {
  importAwesomeList,
  loadConfig,
  writeImportedRecords,
  type Blueprint,
} from "@grove-dev/core";

/**
 * `grove import` — turn an awesome-list README (or any Markdown file
 * full of links) into `data/records/*.yml`.
 *
 * The parser (`importAwesomeList`) and writer (`writeImportedRecords`)
 * already live in `@grove-dev/core`; this command is the thin CLI
 * layer that the v0.5.0 roadmap committed to ship.
 *
 * Source precedence:
 *   - A URL matching `https://github.com/<owner>/<repo>` is rewritten
 *     to its raw README before fetching.
 *   - Any other `http(s)://` URL is fetched as-is.
 *   - Anything else is resolved as a local path.
 *
 * Records land in the site's configured `paths.recordsDir` (default
 * `data/records`) for the configured blueprint. Each emitted file is
 * tagged with `source: { type: 'import' }` so curators can filter
 * imported vs. hand-authored records later.
 *
 * Note: the core `writeImportedRecords` writes to `<cwd>/data/records`.
 * Sites that override `paths.recordsDir` will need to move the emitted
 * files by hand, or the importer will be updated to honor the override
 * in a follow-up. (Roadmap item left in the open until the override
 * matters in practice.)
 */
export function buildImportCommand(): Command {
  return new Command("import")
    .argument(
      "<source>",
      "GitHub awesome-list URL, raw README URL, or local README path",
    )
    .description(
      "Turn an awesome-list README into data/records/<slug>.yml files.",
    )
    .action(async (source: string) => {
      const config = await loadConfig();
      const blueprint = config.blueprint as Blueprint;

      const result = await importAwesomeList(source);
      const { written, dir } = await writeImportedRecords(
        result,
        resolve(process.cwd()),
        blueprint,
      );

      const skipped = result.records.length - written;
      process.stdout.write(
        `[grove import] source: ${source}\n` +
          `[grove import] blueprint: ${blueprint}\n` +
          `[grove import] records: ${result.records.length} detected, ` +
          `${written} written, ${skipped} skipped\n` +
          `[grove import] dir: ${dir}\n`,
      );
    });
}
