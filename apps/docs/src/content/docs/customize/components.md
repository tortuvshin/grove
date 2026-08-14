---
title: Components
description: Replace any default Astro component by importing your own .astro file in your pages. The data engine stays untouched.
---

Grove pages are plain Astro pages that live in your project, so replacing a component is a normal Astro import swap — no config required.

```astro
---
// src/pages/[slug]/index.astro
// Default:
// import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro";
// Your override:
import ProjectCard from "../../components/MyProjectCard.astro";
---
```

Because your project owns its pages, you can start from the reference pages shipped in `@grove-dev/astro` and replace only the components you need. The data models (`@grove-dev/astro/server`) keep working unchanged underneath.

The full component reference is in **[Astro components](/reference/components/)**. The default template customization walk-through is in **[Customize the Astro template](/guides/customize-astro-template/)**.

The convention is: start with the complete default theme, replace only what you need.
