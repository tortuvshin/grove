import { apps } from "./apps";

export type Stack = {
  slug: string;
  name: string;
  blurb: string;
  status: "live" | "expanding" | "planned";
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const stacks: Stack[] = [...new Set(apps.map((app) => app.stack).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    slug: slugify(name),
    name,
    blurb: `Projects whose primary language or stack is ${name}.`,
    status: "live",
  }));
