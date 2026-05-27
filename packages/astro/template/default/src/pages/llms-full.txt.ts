import type { APIRoute } from "astro";
import { apps } from "../data/apps";

function compact(value: number | undefined): string {
  if (typeof value !== "number") return "-";
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://example.com").replace(/\/$/, "");
  const lines: string[] = [];
  lines.push("# Open Curated - full directory");
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} from ${apps.length} project records.`);
  lines.push("");
  lines.push("## Index");
  lines.push("");
  for (const app of apps) {
    lines.push(`- [${app.name}](#${app.slug}) - ${app.category} · ${app.stack} · ${compact(app.stars)} stars`);
  }
  lines.push("");
  lines.push("## Projects");
  lines.push("");
  for (const app of apps) {
    lines.push(`### ${app.name}`);
    lines.push(`Slug: ${app.slug}`);
    lines.push(`URL: ${base}/apps/${app.slug}`);
    lines.push(`Repository: ${app.repoUrl}`);
    lines.push(`Category: ${app.category}`);
    lines.push(`Stack: ${app.stack}`);
    lines.push(`Tags: ${app.tags?.join(", ") || "-"}`);
    lines.push(`Description: ${app.description}`);
    lines.push(`Stars: ${compact(app.stars)}`);
    lines.push(`Forks: ${compact(app.github?.repository?.forks_count)}`);
    lines.push(`Last commit: ${app.lastCommitAt ?? "-"}`);
    lines.push(`Status: ${app.health?.status ?? app.status ?? "-"}`);
    lines.push(`Tier: ${app.tier ?? "-"}`);
    if (app.bestFor?.length) lines.push(`Best for: ${app.bestFor.join("; ")}`);
    if (app.caveats?.length) lines.push(`Caveats: ${app.caveats.join("; ")}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
