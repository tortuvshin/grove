import { describe, expect, it } from "vitest";
import { formatCount, pluralize } from "./directory-format.js";

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
