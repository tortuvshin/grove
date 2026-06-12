// Build-time helpers that compute taxonomy counts from the generated
// apps.json. The static taxonomy files (categories.ts, stacks.ts) hold
// the canonical list of names + blurbs; counts live here so we never
// have to hand-update them.
//
// All functions are synchronous and cheap — they're called from Astro
// page frontmatter at build time, never on the client.

import generatedJson from "../../data/generated/apps.json";

type GeneratedApp = {
  category?: string;
  stack?: string;
};

function loadApps(): GeneratedApp[] {
  const raw = generatedJson as { apps?: GeneratedApp[] };
  return raw.apps ?? [];
}

const apps = loadApps();

/** Number of apps in the directory, per category name. */
export function countByCategory(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of apps) {
    const k = a.category || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Number of apps in the directory, per primary stack. */
export function countByStack(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of apps) {
    const k = a.stack || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
