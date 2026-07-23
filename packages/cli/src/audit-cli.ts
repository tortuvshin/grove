import { Command } from "commander";
import { runAudit } from "./audit.js";

export function buildAuditCommand(): Command {
  return new Command("audit")
    .description("Run Lighthouse 100×4 against every page in grove.config.ts audit.pages[].")
    .option("--base-url <url>", "Override audit.baseUrl from grove.config.ts")
    .option("--mobile", "Mobile profile only")
    .option("--desktop", "Desktop profile only")
    .option("--runs <count>", "Runs per page (default 3, max 5)", (v) => parseInt(v, 10), 3)
    .option("--page <path>", "Audit a single page path (repeatable)", collect, [] as string[])
    .option("--json <path>", "Write JSON report")
    .option("--junit <path>", "Write JUnit XML report")
    .action(async (opts) => {
      process.exitCode = await runAudit(opts);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
