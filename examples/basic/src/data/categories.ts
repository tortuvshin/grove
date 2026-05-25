import { apps } from "./apps";

export type Category = {
  slug: string;
  name: string;
  blurb: string;
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const categories: Category[] = [...new Set(apps.map((app) => app.category))]
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    slug: slugify(name),
    name,
    blurb: `Curated projects in ${name}.`,
  }));
