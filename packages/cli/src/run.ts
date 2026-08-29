// SPDX-License-Identifier: MIT
import { spawn } from "node:child_process";

/**
 * Run a child process with inherited stdio and resolve when it exits 0.
 * Shared by the CLI's subcommands (`pnpm install`, `git init`,
 * `astro check`) and by `grove init`'s `shadcn add` step.
 */
export function run(command: string, args: string[], cwd = process.cwd()): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with ${signal ?? code ?? "unknown status"}`));
    });
  });
}
