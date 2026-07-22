---
name: Pull request
about: Submit a change to one or more Grove packages, the docs, or the templates.
title: ""
---

<!--
Fill out the sections below. Delete any that don't apply — partial is better than missing.
-->

## Summary

<!-- One paragraph. What does this PR change, and why? -->

## Linked issue

<!-- "Closes #123" or "Refs #456" — leave blank if there is no issue. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing behavior to change)
- [ ] Documentation / docs site
- [ ] Template / scaffold content
- [ ] Chore (build, CI, release tooling, deps)

## Packages touched

- [ ] `@grove-dev/core`
- [ ] `@grove-dev/ui`
- [ ] `@grove-dev/cli`
- [ ] `@grove-dev/astro`
- [ ] `@grove-dev/nextjs`
- [ ] `@grove-dev/svelte`
- [ ] `apps/docs/`
- [ ] `examples/`
- [ ] Other: <!-- describe -->

## Public API change?

- [ ] Yes — describe in the "Migration notes" section below.
- [ ] No

## How I tested

<!--
Run the local gates and paste the relevant output. The minimum bar is:
  pnpm -r build
  pnpm -r check
  pnpm test:scaffold
If you only changed docs, just say so and link a preview URL.
-->

```text
<paste the relevant output>
```

## Migration notes

<!-- If this is breaking, what does a downstream space maintainer have to change? -->

## Checklist

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md) and followed the local gates.
- [ ] I added / updated tests where it made sense.
- [ ] I updated the relevant docs (README, docs site, JSDoc).
- [ ] I bumped the right package versions (only if the user-facing API changed; otherwise the release script handles it).
