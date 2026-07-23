import { describe, expect, it } from "vitest";
import { defineConfig } from "./config.js";

describe("Grove config", () => {
  it("accepts an optional GA4 measurement id", () => {
    const config = defineConfig({
      site: { name: "Directory" },
      analytics: { googleAnalyticsId: "G-TEST123" },
    });

    expect(config.analytics.googleAnalyticsId).toBe("G-TEST123");
  });

  it("rejects analytics ids that are not GA4 measurement ids", () => {
    expect(() =>
      defineConfig({
        site: { name: "Directory" },
        analytics: { googleAnalyticsId: "UA-123-1" },
      }),
    ).toThrow(/GA4 measurement ID/);
  });
});
