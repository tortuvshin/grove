import { resolve } from "node:path";
import { syncIconAssets } from "@grove-dev/core";
import { Command } from "commander";
import { resolveRegistrySnapshotDir } from "./registry-install.js";

/**
 * `grove icons sync` — the explicit escape hatch for the icon set.
 *
 * `@grove-dev/astro` already syncs packaged icons into `public/icons/`
 * on every build, so most sites never need this. It exists for the two
 * cases that automatic sync deliberately will not handle: restoring a
 * file you edited (`--force`), and failing CI when the set has drifted
 * (`--check`).
 */
export function buildIconsCommand(): Command {
  const icons = new Command("icons").description("Manage the packaged icon set.");

  icons
    .command("sync")
    .description("Copy the packaged icon set into public/icons/.")
    .option("--force", "overwrite locally modified icons and drop extras")
    .option("--check", "report drift without writing; exit 1 if anything is stale")
    .action(async (options: { force?: boolean; check?: boolean }) => {
      const publicDir = resolve(process.cwd(), "public");
      const source = resolve(resolveRegistrySnapshotDir(), "public/icons");
      const result = await syncIconAssets(source, publicDir, {
        force: options.force === true,
        // `--force` means "make it match the packaged set exactly",
        // which includes removing icons the set no longer ships.
        prune: options.force === true,
        dryRun: options.check === true,
      });

      const stale = result.written.length + result.pruned.length;
      if (options.check) {
        if (stale === 0 && result.skipped.length === 0) {
          console.log("[icons] up to date");
          return;
        }
        for (const file of result.written) console.log(`  stale:    ${file}`);
        for (const file of result.pruned) console.log(`  extra:    ${file}`);
        for (const file of result.skipped) console.log(`  modified: ${file}`);
        console.error("[icons] out of date — run `grove icons sync`");
        process.exitCode = 1;
        return;
      }

      console.log(
        `[icons] ${result.written.length} written, ${result.pruned.length} removed, ${result.skipped.length} kept`,
      );
      for (const file of result.skipped) {
        console.log(`  kept (locally modified): ${file}`);
      }
      if (result.skipped.length > 0) {
        console.log("Run `grove icons sync --force` to restore the packaged versions.");
      }
    });

  return icons;
}
