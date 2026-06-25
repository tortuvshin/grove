import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { syncContributors } from "./contributors.js";

describe("syncContributors", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "grove-contributors-"));
    await mkdir(join(cwd, "data", "generated"), { recursive: true });
    await writeFile(
      join(cwd, "data", "generated", "records.index.json"),
      JSON.stringify({
        records: [
          {
            kind: "project",
            slug: "one",
            repoUrl: "https://github.com/acme/one",
          },
          {
            kind: "project",
            slug: "two",
            github: { fullName: "acme/two" },
          },
        ],
      }),
    );
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("aggregates contributors across repositories and writes generated JSON", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const contributors = url.includes("/one/")
        ? [
            {
              login: "alice",
              avatar_url: "https://avatars.example/alice",
              html_url: "https://github.com/alice",
              contributions: 3,
            },
          ]
        : [
            {
              login: "alice",
              avatar_url: "https://avatars.example/alice",
              html_url: "https://github.com/alice",
              contributions: 4,
            },
            {
              login: "bob",
              avatar_url: "https://avatars.example/bob",
              html_url: "https://github.com/bob",
              contributions: 2,
            },
          ];
      return new Response(JSON.stringify(contributors), { status: 200 });
    };

    const result = await syncContributors({ cwd, fetchImpl, generatedAt: "2026-06-25T00:00:00.000Z" });
    const output = JSON.parse(await readFile(result.outputPath, "utf8")) as {
      generatedAt: string;
      contributors: Array<{ username: string; contributions: number }>;
    };

    expect(result.repositories).toBe(2);
    expect(output).toEqual({
      generatedAt: "2026-06-25T00:00:00.000Z",
      contributors: [
        {
          username: "alice",
          avatarUrl: "https://avatars.example/alice",
          profileUrl: "https://github.com/alice",
          contributions: 7,
        },
        {
          username: "bob",
          avatarUrl: "https://avatars.example/bob",
          profileUrl: "https://github.com/bob",
          contributions: 2,
        },
      ],
    });
  });
});
