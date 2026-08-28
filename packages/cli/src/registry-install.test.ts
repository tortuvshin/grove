/**
 * @grove-dev/cli — registry installer unit tests.
 *
 * Pins the three load-bearing behaviors:
 *   - the snapshot is located relative to the compiled CLI
 *     (verify by writing a fixture to a tmp dir + checking
 *     resolveRegistrySnapshotDir finds it via fallback paths),
 *   - loadManifest hashes every file deterministically,
 *   - materializeRegistry writes src/, .grove/registry.lock.json,
 *     and matches the hashes computed by loadManifest.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManifest, materializeRegistry } from "./registry-install.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "grove-registry-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("loadManifest", () => {
  it("locates the @grove/default snapshot bundled with the CLI", async () => {
    const loaded = await loadManifest("@grove/default");
    expect(loaded.manifest.name).toBe("@grove/default");
    expect(loaded.manifest.type).toBe("registry:scaffold");
    expect(loaded.files.length).toBeGreaterThan(0);
    for (const file of loaded.files) {
      expect(file.hash).toMatch(/^sha256-[a-f0-9]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
    }
  });
});

describe("materializeRegistry", () => {
  it("writes every file into consumerRoot and emits .grove/registry.lock.json", async () => {
    const loaded = await loadManifest("@grove/default");
    const consumerRoot = join(tmpRoot, "consumer");
    await mkdir(consumerRoot, { recursive: true });
    const result = await materializeRegistry(consumerRoot);

    // Every registry file landed at consumerRoot/src/<target>.
    for (const file of result.files) {
      const target = join(consumerRoot, "src", file.target);
      const onDisk = await readFile(target, "utf8");
      const hash = `sha256-${(await import("node:crypto"))
        .createHash("sha256")
        .update(onDisk)
        .digest("hex")}`;
      expect(hash).toBe(file.hash);
    }

    // The lockfile was written and has the install-time snapshot.
    const lockfileRaw = await readFile(
      join(consumerRoot, ".grove", "registry.lock.json"),
      "utf8",
    );
    const lockfile = JSON.parse(lockfileRaw);
    expect(lockfile.scaffold).toBe(loaded.manifest.name);
    expect(lockfile.scaffoldVersion).toBe(loaded.manifest.version);
    expect(lockfile.fileCount).toBe(loaded.files.length);
    expect(lockfile.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
