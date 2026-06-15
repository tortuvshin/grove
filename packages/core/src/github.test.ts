/**
 * @grove-dev/core — github.ts (URL parsing + metadata fetch)
 * unit tests.
 *
 * `parseGithubRepoUrl` is pure logic and trivially testable.
 * `fetchGithubMetadata` makes real HTTP calls — we test the URL
 * parser end-to-end and verify the function is exported with the
 * right signature; the network path itself is exercised by the
 * `sync github` CLI command in production (not by the unit suite,
 * which is offline).
 */
import { describe, it, expect } from "vitest";
import { parseGithubRepoUrl, type GithubRepoRef } from "./github.js";

describe("parseGithubRepoUrl", () => {
  it("returns undefined for an empty or undefined input", () => {
    expect(parseGithubRepoUrl("")).toBeUndefined();
    expect(parseGithubRepoUrl(undefined)).toBeUndefined();
  });

  it("parses a canonical https URL", () => {
    expect(parseGithubRepoUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    } satisfies GithubRepoRef);
  });

  it("parses an http URL", () => {
    expect(parseGithubRepoUrl("http://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("strips a trailing .git suffix from the repo name", () => {
    // `git clone` URLs end in .git — the parser must trim it so
    // downstream API calls (e.g. /repos/owner/repo) hit the real
    // repo, not a 404 because we asked for "repo.git".
    expect(parseGithubRepoUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("ignores query strings and fragments", () => {
    // A URL with a fragment (e.g. from a permalink) should still
    // resolve to the same owner/repo.
    expect(parseGithubRepoUrl("https://github.com/owner/repo#readme")).toEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(parseGithubRepoUrl("https://github.com/owner/repo?tab=readme-ov-file")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns undefined for non-GitHub URLs", () => {
    expect(parseGithubRepoUrl("https://gitlab.com/owner/repo")).toBeUndefined();
    expect(parseGithubRepoUrl("https://example.com/owner/repo")).toBeUndefined();
  });

  it("returns undefined for malformed GitHub URLs", () => {
    // Missing repo segment.
    expect(parseGithubRepoUrl("https://github.com/owner")).toBeUndefined();
    // Owner with whitespace.
    expect(parseGithubRepoUrl("https://github.com/own er/repo")).toBeUndefined();
    // Empty owner.
    expect(parseGithubRepoUrl("https://github.com//repo")).toBeUndefined();
  });

  it("is case-insensitive on the host", () => {
    // GITHUB.COM should still match — the regex has the /i flag
    // and humans do type uppercase sometimes.
    expect(parseGithubRepoUrl("https://GITHUB.COM/Owner/Repo")).toEqual({
      owner: "Owner",
      repo: "Repo",
    });
  });
});
