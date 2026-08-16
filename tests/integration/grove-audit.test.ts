import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const cli = resolve(root, "packages/cli/dist/index.js");
const example = resolve(root, "apps/example");

let preview: ReturnType<typeof spawn> | undefined;

async function waitForReady(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

describe("grove audit @apps/example", () => {
  beforeAll(async () => {
    // `astro preview` defaults to `localhost`, which on macOS resolves to
    // IPv6 `[::1]` first. Without `--host 127.0.0.1` the server binds only
    // to IPv6, and `waitForReady` below (which polls `127.0.0.1`)
    // times out — or worse, a separate IPv4 listener on the same port
    // silently answers and the audit tests a stranger's site. Forcing
    // IPv4 here keeps the test self-contained on a developer's machine.
    preview = spawn("pnpm", ["preview", "--host", "127.0.0.1"], {
      cwd: example,
      stdio: "pipe",
      env: { ...process.env, HOST: "127.0.0.1", PORT: "4321" },
    });
    await waitForReady("http://127.0.0.1:4321/");
  }, 60_000);

  afterAll(async () => {
    preview?.kill("SIGTERM");
  });

  it("runs a 3-sample audit (median) and reports 100×4 on every fixture page", async () => {
    // The 100×4 budget is tight: a single Lighthouse run lands within
    // 0.05 of 1.0 on a CI runner, which trips performance/accessibility
    // violations even when nothing in the example regressed. The audit
    // CLI aggregates runs by median; running 3 samples (the audit-cli
    // default) lets the median absorb the per-run variance while still
    // failing on a real regression. `--runs` is clamped to [1, 5].
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolveResult, reject) => {
        const child = spawn(process.execPath, [cli, "audit", "--runs", "3"], {
          cwd: example,
          stdio: "pipe",
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += String(d)));
        child.stderr.on("data", (d) => (stderr += String(d)));
        child.on("exit", (code) => resolveResult({ code, stdout, stderr }));
        child.on("error", reject);
      },
    );
    expect(result.code, `stderr:\n${result.stderr}\nstdout:\n${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/✓ \d+ page\/profile combinations passed the budget/);
  }, 600_000);
});
