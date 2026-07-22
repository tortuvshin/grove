// @ts-check
// SPDX-License-Identifier: MIT
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import groveAstro from '@grove-dev/astro';

// `site` is the canonical URL the build uses for absolute links
// (sitemap, OpenGraph, canonical tags, JSON-LD). The CLI injects
// `grove.config.ts` → `site.url` at scaffold time, but it can also
// be overridden per-build via the `SITE_URL` env var.
//
// The Grove integration prepares data, sitemap, and llms files before
// Astro starts. No consumer-owned prebuild script is required.
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  trailingSlash: 'ignore',
  integrations: [groveAstro()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'directory',
  },
});
