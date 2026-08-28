import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buttonClass, chipClass, filterTriggerClass, lensTabClass } from "./button.js";

describe("button class builders", () => {
  it("keeps selection state on the selected tokens, never the brand primary", () => {
    for (const cls of [
      buttonClass("selected"),
      filterTriggerClass(true),
      lensTabClass(true),
    ]) {
      expect(cls).toContain("bg-selected");
      expect(cls).not.toContain("bg-primary");
    }
  });

  it("uses the brand primary only for the primary variant", () => {
    expect(buttonClass("primary")).toContain("bg-primary");
    expect(buttonClass("secondary")).not.toContain("bg-primary");
  });

  it("guarantees a 44px mobile hit target on md and lg sizes", () => {
    expect(buttonClass("secondary", "md")).toContain("max-sm:min-h-11");
    expect(buttonClass("secondary", "lg")).toContain("h-11");
    expect(filterTriggerClass(false)).toContain("max-sm:min-h-11");
    expect(lensTabClass(false)).toContain("max-sm:min-h-11");
  });

  it("keeps the filter-trigger hook class through client reassignment", () => {
    expect(filterTriggerClass(true)).toContain("grove-filter-trigger");
    expect(filterTriggerClass(false)).toContain("grove-filter-trigger");
  });

  it("is the single source for chip classes on both server and client", () => {
    // The browse page (server) and DirectoryIndexClient (client JS)
    // must render byte-identical chips. Both now import chipClass —
    // assert neither has regressed to an inline copy of the string.
    const clientSource = readFileSync(
      resolve(import.meta.dirname, "../components/DirectoryIndexClient.astro"),
      "utf8",
    );
    const serverPage = readFileSync(
      resolve(import.meta.dirname, "../../../../apps/example/src/components/DirectoryBrowse.astro"),
      "utf8",
    );
    expect(clientSource).toContain("chipClass()");
    expect(serverPage).toContain("chipClass()");
    const inlineChip = "min-h-5 items-center justify-center gap-1 rounded-full";
    expect(clientSource).not.toContain(inlineChip);
    expect(serverPage).not.toContain(inlineChip);
    expect(chipClass()).toContain(inlineChip);
  });
});
