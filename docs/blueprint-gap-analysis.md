# Blueprint Gap Analysis — Grove default template vs. open-apps

> **Тулгуур:** open-apps бол framework-ийн **эхний showcase** (2026-06-10).
> Framework-ийн суурь generic байх ёстой, гэхдээ **blueprint-уудын нэг** нь open-apps-тай яг ижил UI-тай байх ёстой.
> Одоо энэ нь огт биелэхгүй байна.

## Тойм

| Хэмжүүр                 | open-apps (production)                                                   | Grove (default template)                           | Зөрүү |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- | ----- |
| Home page section       | 9                                                                        | 2                                                  | 4.5×  |
| Home component          | 18                                                                       | 0                                                  | ∞     |
| Layout component        | 7                                                                        | 2                                                  | 3.5×  |
| Pages                   | 7 (home, apps, apps/[slug], about, contributors, submit, sitemap.xml.ts) | 4 (home, projects, projects/[slug], about, submit) | 1.4×  |
| Data records            | 79 hand-curated YAML                                                     | 6 generic YAML                                     | 13×   |
| Operational scripts     | 18 production .mjs                                                       | 0 (CLI handles it)                                 | n/a   |
| Lighthouse (perception) | high                                                                     | minimal                                            | —     |

## 1. Schema зөрүү

### Open-apps (`src/data/types.ts` → `OpenSourceApp`)

```ts
{
  // Identity
  name: string,
  slug: string,
  repoUrl: string,
  logoUrl?: string,
  description: string,

  // Classification
  category: string,
  stack: string,
  stacks?: string[],
  platforms: string[],

  // GitHub signals
  stars: number,
  forks: number,
  contributors: number,
  lastCommitAt: string,
  license?: string,

  // Curation
  labels?: string[],     // ["new" | "hot" | "mature" | "stale" | ...]
  status?: string,
  bestFor?: string[],
  whyListed?: string[],
  caveats?: string[],

  // Scoring
  scores?: { activity, maturity, learning, contribution, documentation },
}
```

### Grove (`@grove-dev/core` → `Resource`)

```ts
{
  kind: "resource",
  slug: string,
  title: string,        // ↔ open-apps.name
  name?: string,        // ↔ open-apps.name
  description: string,
  category: string,
  tags: string[],       // ↔ open-apps.platforms + stacks + tags
  links: { github?, website?, ... },
  curation: { labels?: string[], visibility, ... },
  health: { ... },      // signals from analyze
  // ❌ repoUrl, logoUrl, stack, stacks, platforms, stars, forks,
  //    contributors, lastCommitAt, license, bestFor, whyListed,
  //    caveats, scores, status
}
```

### Schema gap (schema нэмэх шаардлагатай)

- `repoUrl: string` — `links.github`-аас ялгаатай (links нь UI label-д зориулагдсан, repoUrl нь canonical).
- `logoUrl: string` — кард дээр avatar-д ашиглана.
- `stack: string` + `stacks: string[]` — single primary + multiple secondary.
- `platforms: string[]` — stack-аас тусад нь (Flutter нь stack, iOS нь platform).
- `stars, forks, contributors, lastCommitAt: number/string` — GitHub signals-ыг cached хийх.
- `license?: string` — кард дээр chip-ээр харуулна.
- `bestFor: string[]`, `whyListed: string[]`, `caveats: string[]` — curated content (open-apps-ын хамгийн ялгаатай тал).
- `scores: { activity, maturity, learning, contribution, documentation }` — score bars-д.
- `status: "stale" | ...` — health signal override.

## 2. UI component-ийн зөрүү

### Open-apps-ын component taxonomy

```
src/components/
├── home/
│   ├── Hero.astro                    (trust stats, search, CTA, animated gradient)
│   ├── AppSection.astro              (lens = "Hot" / "New" / "Mature")
│   ├── AppCard.astro                 (★, updated, license, logos, stack chips,
│   │                                  platform chips, curated mark, view repo, details)
│   ├── AppsIndexRow.astro            (list view, more compact)
│   ├── AppsPagination.astro
│   ├── StackGrid.astro               (browse by stack, 16 cells)
│   ├── CategoryGrid.astro            (browse by category)
│   ├── ContributorsGrid.astro        (community section)
│   ├── ExploreByCategory.astro
│   ├── ExploreByStack.astro
│   ├── ScoreBars.astro               (horizontal bar viz)
│   ├── SmartLensTabs.astro           (lens switcher: All / Hot / New / Mature)
│   ├── RefinePanel.astro             (search + filter side panel)
│   ├── DecisionRow.astro
│   ├── WhyThisExists.astro
│   ├── OriginalCollection.astro      (legacy: open-source-flutter-apps lineage)
│   └── MinimalAbout.astro
├── layout/
│   ├── BaseLayout.astro              (theme script, GA4, JSON-LD slot, body-end slot)
│   ├── Header.astro                  (logo, nav, submit, GitHub star count, theme toggle)
│   ├── Footer.astro                  (4-col: brand + 3 link groups + bar)
│   ├── Container.astro
│   ├── SectionHeader.astro
│   ├── ThemeToggle.astro             (light/dark/system)
│   └── Seo.astro                     (OG, Twitter, JSON-LD, canonical)
└── icons/
    └── Icon.astro                    (platform + stack icon registry, 60+ icons)
```

### Grove default template-ийн component taxonomy

```
packages/astro/src/
├── components/
│   └── ItemCard.astro                 (1 generic card)
└── layouts/
    └── BaseLayout.astro               (47 lines, no GA, no theme script, no JSON-LD slot)
examples/grove-demo/src/components/
└── layout/
    ├── BaseLayout.astro
    ├── Header.astro                   (logo + 4 nav items)
    ├── Footer.astro                   (1 line)
    └── Container.astro
```

### Гол алгасал

- ❌ **Hero** — trust stats, search form, animated gradient, CTA бүгд байхгүй
- ❌ **AppCard** — 1 generic `ItemCard` л байна; logo, owner, repo link, stack chips, platform chips, status badge, license, view repo/detail links, curated mark бүгд байхгүй
- ❌ **AppSection / StackGrid / CategoryGrid** — home-ийн бүх "explore" секц байхгүй
- ❌ **RefinePanel** — apps listing дээрх filter side panel
- ❌ **SmartLensTabs** — apps listing дээрх lens switcher
- ❌ **ThemeToggle** — BaseLayout-д inline script байхгүй, system/light/dark три-сүйтч байхгүй
- ❌ **Seo** — OG, Twitter, JSON-LD, canonical байхгүй
- ❌ **Icon** — 60+ platform/stack icon registry байхгүй
- ❌ **ScoreBars, AppsIndexRow, AppsPagination, DecisionRow, ContributorsGrid** — бүгд байхгүй
- ❌ **WhyThisExists, OriginalCollection, MinimalAbout** — open-apps-ын ялгарах content section-ууд байхгүй

## 3. Pages зөрүү

| Open-apps                          | Grove default                          |
| ---------------------------------- | -------------------------------------- |
| `index.astro` (home, 9 секц)       | `index.astro` (home, 2 секц)           |
| `apps/index.astro` (filter + grid) | `projects/index.astro` (filter + grid) |
| `apps/[slug].astro` (detail)       | `projects/[slug].astro` (detail)       |
| `about.astro` (rich, 21K byte)     | `about.astro` (3K byte)                |
| `contributors.astro`               | —                                      |
| `submit.astro` (rich, 19K byte)    | `submit.astro` (3K byte)               |
| `sitemap.xml.ts`                   | — (CLI-аас `grove sitemap`)            |
| `/llms.txt` + `/llms-full.txt`     | (CLI-аас `grove llms`)                 |

## 4. Design token & CSS-ийн зөрүү

### Tailwind config

- Хоёулаа **яг ижил** palette (`ink-*`, accent, emerald/orange/blue/amber, font sizes, maxWidth, keyframes). Энэ нь зөв.
- Гэхдээ `global.css` дээр open-apps нь **9 component class**-тай:
  ```
  .section, .section-tight,
  .card, .card-hover,
  .badge, .badge-accent, .badge-new, .badge-hot, .badge-mature, .badge-stale,
  .btn, .btn-ghost, .btn-outline, .btn-primary
  ```
  → Эдгээр нь app-ын бүх UI-ын **visual contract**. Generic template-д байхгүй.

### Color usage doctrine зөрүү

- **open-apps**: semantic class + utility хослол (`.card .card-hover`, `.btn-primary`, `.badge-new`).
- **grove**: цэвэр utility + scoped CSS variables (`.grove-card`, `var(--grove-border)`).

→ Аль нь зөв вэ? **Хоёулаа**. Generic template нь utility-г, showcase blueprint нь semantic class-ыг ашиглавал architecture цэвэр.

## 5. Operational / toolchain зөрүү

### Open-apps scripts (18 .mjs)

Domain-specific (blueprint-д үлдээнэ):

- `enrich-github-metadata.mjs` — 79 app-ыг GitHub-аас metadata-тай нь sync хийх
- `refresh-apps-activity.mjs` — daily scheduled activity refresh
- `sync-contributors.mjs` — contributors page
- `seed-from-github.mjs` — initial GitHub-аас seed
- `import-react-native-list.mjs` — legacy list import
- `parse-legacy-readme.mjs` — README → schema
- `migrate-legacy-to-schema-v1.mjs` — version migration
- `report-cleanup-candidates.mjs` — stale signal
- `repair-license-format.mjs` — data hygiene
- `validate-apps.mjs` — schema validation
- `build-apps-json.mjs` — YAML → JSON build
- `app-schema.mjs` — Zod schema
- `fetch-icons.mjs` — platform/stack icon cache

Generic (framework-д шилжүүлэх боломжтой):

- `validate-apps.mjs` → `grove validate`
- `build-apps-json.mjs` → `grove generate`
- `build-llms-full.mjs` → `grove llms`
- `fetch-icons.mjs` → `grove icons` (generic icon resolver)

## 6. Санал

### Сонголт A: Blueprint pattern нэвтрүүлэх (зөв)

1. **Schema-ийг өргөтгөх** — `@grove-dev/core`-ын `Resource` type-д open-apps-ын бүх талбарыг optional байдлаар нэмэх (back-compat хадгална):
   - `repoUrl`, `logoUrl`, `stack`, `stacks`, `platforms`, `stars`, `forks`, `contributors`, `lastCommitAt`, `license`, `bestFor`, `whyListed`, `caveats`, `scores`, `status`
2. **Blueprint template нэмэх** — `packages/astro/templates/open-apps/` гэсэн тусдаа template:
   - Open-apps-ын бүх component-ыг хуулж авна (Hero, AppCard, AppSection, StackGrid, …)
   - Data нь `@grove-dev/core` API-аас уншина (`records.filter(r => r.curation?.labels?.includes("hot"))`)
   - Template нь `grove.config.ts`-д `blueprint: "open-apps"` гэж заана
3. **Default template minimal хэвээр** — generic showcase (2 секц, 1 кард) хэвээр үлдэнэ
4. **CLI өргөтгөл** — `grove new my-dir --blueprint open-apps` гэж сонгоход уг template сууна
5. **Generic scripts шилжүүлэх** — validate, generate, llms, icons-ыг framework CLI-д нэгтгэх

### Сонголт B: Showcase space гэж тусдаа хадгалах

- `examples/open-apps/` showcase нэмнэ
- Одоогийн бүтэцтэй нийцүүлэхэд хялбар
- Гэхдээ blueprint pattern дахин хэрэгжүүлэхгүй, харин showcase хувилбар л болно

### Зөвлөмж

**Сонголт A**. Учир нь:

- Generic framework + нэг showcase blueprint (open-apps) + ирээдүйн бусад blueprint-ууд (oss-dev-mn, tools-dev-mn, ai-dev-mn, startups-dev-mn) гэсэн **scalable architecture** үүснэ.
- Open-apps нь **"directory of real apps"** гэдэг тодорхой use case-д зориулсан blueprint. Generic `project-directory`-аас ялгаатай нь: GitHub signals (stars, updated, license), curation metadata (bestFor, whyListed, caveats), score system, contributor section, original collection lineage.
- Өөр blueprint-ууд өөр өөрийн гэсэн UI-тай байх боломжтой (oss-dev-mn-д Mongolian locale, tools-dev-mn-д integration patterns, гэх мэт).

### Дараагийн алхам

1. `Resource` type-д schema fields нэмэх (`@grove-dev/core/src/schema/resource.ts`).
2. Open-apps-ыг `packages/astro/templates/open-apps/` руу хуулж, import path-ыг `@grove-dev/core`-оос болгох.
3. `examples/open-apps/` (эсвэл `examples/grove-openapps/`) showcase-ыг шинэ template-аар дахин босгох.
4. `grove new` CLI-д `--blueprint open-apps` flag нэмэх.
5. Generic scripts (`validate`, `generate`, `llms`, `icons`) framework руу шилжүүлэх.
