import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buttonClass, chipClass, filterTriggerClass, lensTabClass } from "./classnames.ts";

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

  it("is the single source for chip classes — the client rebuild imports it rather than duplicating the string", () => {
    // This file ships as-is to every `grove init`'d project (it lives
    // under lib/, which the registry installs verbatim), so it must
    // only reach into the scaffold's own tree — no path outside
    // src/ exists once installed. Consumer pages that render chips
    // server-side are expected to import `chipClass` too, but that
    // can't be asserted generically here; it's covered per-consumer
    // (apps/example's own DirectoryBrowse.astro is the canonical
    // example of doing this correctly).
    const clientSource = readFileSync(
      resolve(import.meta.dirname, "../components/grove/directory-index-client.astro"),
      "utf8",
    );
    expect(clientSource).toContain("chipClass()");
    const inlineChip = "min-h-5 items-center justify-center gap-1 rounded-full";
    expect(clientSource).not.toContain(inlineChip);
    expect(chipClass()).toContain(inlineChip);
  });
});
