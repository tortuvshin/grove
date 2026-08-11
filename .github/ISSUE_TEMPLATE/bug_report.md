---
name: Bug report
description: Something is broken — a CLI command, a build step, a template, or unexpected behavior in a packaged adapter.
title: "[bug] "
labels: ["bug", "triage"]
---

<!--
Thanks for filing a bug. Please fill out the sections below — the more we know, the faster we can reproduce and fix.
If you're reporting a security issue, see SECURITY.md instead.
-->

### What happened

<!-- A clear, one-paragraph description of the bug. -->

### Steps to reproduce

```bash
# Smallest possible command(s) that hit the bug.
grove init my-space --framework astro
cd my-space
# ...whatever you ran after
```

If the bug only happens with a specific data file, paste a minimal `data/records/*.yml` (or attach the smallest sample you can).

### Expected behaviour

<!-- What you thought would happen. -->

### Actual behaviour

<!-- What actually happened — including the full error output. -->

```text
<paste the full error / stack trace here>
```

### Environment

- **Grove version(s)** — output of `pnpm ls -r --depth=-1` or `grove --version`
- **Node.js version** — `node -v`
- **pnpm version** — `pnpm -v`
- **OS** — macOS / Linux / Windows (WSL?)
- **Framework adapter** (if relevant) — `@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`

### Anything else?

<!-- Screenshots, links to related issues, workarounds you found, etc. -->
