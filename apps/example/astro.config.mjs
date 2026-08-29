// @ts-check
// SPDX-License-Identifier: MIT

import groveAstro from '@grove-dev/astro';
import { loadConfig } from '@grove-dev/core';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// `site` is the canonical URL the build uses for absolute links
// (sitemap, OpenGraph, canonical tags, JSON-LD). It is read directly
// from `grove.config.ts` and can be overridden per build via `SITE_URL`.
//
// The Grove integration prepares data, sitemap, and llms files before
// Astro starts. No consumer-owned prebuild script is required.
const groveConfig = await loadConfig();

export default defineConfig({
  site: process.env.SITE_URL || groveConfig.site.url,
  trailingSlash: 'ignore',
  integrations: [groveAstro()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'directory',
  },
});
