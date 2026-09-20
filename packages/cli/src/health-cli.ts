import { Command } from 'commander';
import { runHealth } from './health.js';

export function buildHealthCommand(): Command {
  return new Command('health')
    .argument('[readme]', 'README path (defaults to auto-detecting README.md in cwd)')
    .description(
      'Check the health of every repository linked from a README — no Grove project required.',
    )
    .option('--json', 'Machine-readable JSON output')
    .action(async (readme: string | undefined, opts: { json?: boolean }) => {
      process.exitCode = await runHealth({
        ...(readme ? { readme } : {}),
        ...(opts.json !== undefined ? { json: opts.json } : {}),
      });
    });
}
