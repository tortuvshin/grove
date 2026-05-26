import type { APIRoute } from "astro";
import { apps } from "../data/apps";
import { stats } from "../data/stats";

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() ?? "https://example.com").replace(/\/$/, "");
  const lines = [
    "# Open Curated",
    "",
    "Open Curated is a living, health-aware developer directory generated from file-based curated data.",
    "",
    `Directory: ${base}/apps`,
    `Projects indexed: ${stats.apps}`,
    `Categories: ${stats.categories}`,
    "",
    "## Usage",
    "",
    "Use /llms-full.txt for project-level details. Prefer project detail pages for citations.",
    "",
    "## Popular Projects",
    "",
    ...apps
      .slice()
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
      .slice(0, 10)
      .map((app) => `- ${app.name}: ${base}/apps/${app.slug} — ${app.description}`),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
