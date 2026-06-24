import { describe, expect, it } from "vitest";

import { recordsFileSchema, resourceSchema } from "./index.js";

describe("public schema API", () => {
  it("exports the complete resource validators for consumer migrations", () => {
    expect(recordsFileSchema).toBe(resourceSchema);
    expect(
      recordsFileSchema.safeParse({
        kind: "project",
        slug: "example",
        name: "Example",
      }).success,
    ).toBe(true);
  });
});
