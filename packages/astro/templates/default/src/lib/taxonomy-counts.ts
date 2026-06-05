// Build-time helpers that compute taxonomy counts from generated
// apps.json. The static taxonomy files hold the canonical list of
// names + blurbs; counts live here.
import generatedJson from "../../data/generated/apps.json";

type GeneratedApp = { category?: string; stack?: string };

function loadApps(): GeneratedApp[] {
  const raw = generatedJson as { apps?: GeneratedApp[] };
  return raw.apps ?? [];
}

const apps = loadApps();

export function countByCategory(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of apps) {
    const k = a.category || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function countByStack(): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of apps) {
    const k = a.stack || "Other";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
