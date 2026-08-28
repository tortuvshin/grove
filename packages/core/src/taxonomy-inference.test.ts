/**
 * @grove-dev/core — taxonomy inference unit tests.
 *
 * Pins the topic/language → stack rules. These are the rules the
 * submit form uses to pre-fill the primary-stack field from a
 * fetched GitHub repo. They were inline in
 * `SubmissionClient.astro` lines 83–91 in v0.7; v1 lifts them
 * into core so they live where the rest of the taxonomy code
 * lives and can be tested without spinning up the form.
 */
import { describe, it, expect } from "vitest";
import { inferStackFromTopics } from "./taxonomy-inference.js";

describe("inferStackFromTopics", () => {
  it("returns flutter for the flutter topic or dart language", () => {
    expect(inferStackFromTopics({ topics: ["flutter"] })).toBe("flutter");
    expect(inferStackFromTopics({ language: "Dart" })).toBe("flutter");
    expect(inferStackFromTopics({ language: "dart", topics: ["ui"] })).toBe(
      "flutter",
    );
  });

  it("returns react-native for the react-native topic", () => {
    expect(inferStackFromTopics({ topics: ["react-native"] })).toBe(
      "react-native",
    );
  });

  it("returns ios for swift or objective-c", () => {
    expect(inferStackFromTopics({ language: "Swift" })).toBe("ios");
    expect(inferStackFromTopics({ language: "Objective-C" })).toBe("ios");
  });

  it("returns android for kotlin or java", () => {
    expect(inferStackFromTopics({ language: "Kotlin" })).toBe("android");
    expect(inferStackFromTopics({ language: "Java" })).toBe("android");
  });

  it("falls back to the lowercased language for unknown languages", () => {
    expect(inferStackFromTopics({ language: "Go" })).toBe("go");
    expect(inferStackFromTopics({ language: "Rust" })).toBe("rust");
  });

  it("returns null when no language or topic signal exists", () => {
    expect(inferStackFromTopics({})).toBeNull();
    expect(inferStackFromTopics({ language: null, topics: [] })).toBeNull();
  });
});
