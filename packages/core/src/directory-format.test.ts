import { describe, expect, it } from "vitest";
import { formatCount, pluralize, truncateWords } from "./directory-format.js";

describe("count formatting", () => {
  it("picks the singular form for exactly one", () => {
    expect(pluralize(1, "project", "projects")).toBe("project");
    expect(formatCount(1, { singular: "project", plural: "projects" })).toBe("1 project");
  });

  it("picks the plural form for zero and many", () => {
    expect(pluralize(0, "project", "projects")).toBe("projects");
    expect(pluralize(3, "project", "projects")).toBe("projects");
    expect(formatCount(0, { singular: "project", plural: "projects" })).toBe("0 projects");
  });

  it("supports irregular plurals via the explicit pair", () => {
    expect(formatCount(2, { singular: "entity", plural: "entities" })).toBe("2 entities");
    expect(formatCount(1, { singular: "entity", plural: "entities" })).toBe("1 entity");
  });
});

describe("description trimming", () => {
  const long =
    "A Python framework for coordinating role-based autonomous agents, tasks, and multi-step crews.";

  it("leaves anything within budget untouched", () => {
    expect(truncateWords("Short and done.", 140)).toBe("Short and done.");
  });

  it("cuts on a word boundary, never mid-word", () => {
    // The card also line-clamps, but a CSS clamp cuts at whatever
    // character the box runs out of room on — "…and multi-", "…an".
    const trimmed = truncateWords(long, 60);
    expect(trimmed.endsWith("…")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(61);
    expect(long).toContain(trimmed.slice(0, -1));
    expect(trimmed.slice(0, -1).endsWith(" ")).toBe(false);
    // The last kept word is whole.
    const lastWord = trimmed.slice(0, -1).split(" ").pop() as string;
    expect(long.split(/[\s,.]+/)).toContain(lastWord);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(truncateWords("one two three, four five", 15)).toBe("one two three…");
  });

  it("hard-cuts a single word longer than the budget", () => {
    expect(truncateWords("supercalifragilistic", 10)).toBe("supercalif…");
  });
});
