import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://example.com",
  trailingSlash: "ignore",
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: "directory",
  },
});
