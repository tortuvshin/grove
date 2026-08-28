# Grove UI Architecture vNext

> **Status:** Architecture specification for the `v1` branch.
> Defines how Grove separates **engine packages** (imported) from **consumer-owned UI source** (installed via registry).
>
> See [`vision.md`](./vision.md) for the historical direction this builds on.

## Core principle

> Grove installs a complete working UI scaffold, but Grove does not own the consumer's runtime UI.

Consumer нь эхнээсээ бүрэн ажилладаг directory site авна.

```bash
grove init
```

үр дүнд:

```text
src/
├─ components/
│  ├─ ui/
│  └─ grove/
├─ layouts/
├─ pages/
├─ styles/
└─ lib/
```

бэлэн орж ирнэ.

Хэрэглэгч Button, Card, Header бүрийг нэг нэгээр нь суулгах шаардлагагүй.

---

# 1. `grove init` must stay lightweight

`grove init` өөрөө component generation engine болохгүй.

Тэр:

```text
1. Grove core/integration setup
2. Grove config setup
3. shadcn-compatible registry scaffold install
4. generated-data wiring
```

хийхэд хангалттай.

Conceptually:

```text
grove init
       │
       ├── install Grove engine
       │
       └── install @grove/default scaffold
                        │
                        ▼
               consumer-owned source
```

CLI дотор UI templates hardcode хийхгүй.

Canonical UI source нь registry байна.

---

# 2. Full scaffold, not individual components

Default workflow:

```bash
grove init
```

→ complete usable Grove site.

Internally scaffold registry item:

```text
@Grove/default
```

эсвэл:

```text
@Grove/directory
```

dependency tree-ээр бүх шаардлагатай source-ийг суулгана.

Example:

```text
directory
├─ ui/button
├─ ui/badge
├─ ui/input
├─ ui/separator
├─ ui/sheet
├─ ui/theme-toggle
│
├─ grove/project-card
├─ grove/collection-card
├─ grove/filter-bar
├─ grove/project-header
│
├─ layouts/base-layout
├─ layouts/header
├─ layouts/footer
│
└─ pages
   ├─ home
   ├─ directory
   ├─ detail
   ├─ collections
   └─ about
```

Individual registry items байж болно.

Гэхдээ тэд primary installation UX биш.

Тэд registry dependency management болон advanced customization-д зориулагдана.

---

# 3. Registry becomes the canonical UI source

Одоогийн:

```text
packages/astro/src/components
packages/astro/src/ui
packages/astro/src/layouts
```

нь canonical UI source байх ёсгүй.

Target:

```text
registry/
├─ default/
├─ ui/
├─ components/
├─ layouts/
├─ pages/
└─ styles/
```

Canonical source:

```text
registry
```

Consumer copy:

```text
src/
```

Runtime package copy:

```text
NONE
```

---

# 4. Updates must come through Grove registry

Энэ нь хамгийн чухал хэсгүүдийн нэг.

Consumer source өөрийнх учраас:

```bash
pnpm update @grove-dev/astro
```

хийхэд UI нь өөрөө өөрчлөгдөж болохгүй.

Instead:

```bash
grove update
```

registry-ийн шинэ scaffold-тай consumer source-ийг харьцуулна.

Concept:

```text
Registry v2
   │
   │ diff
   ▼
Consumer customized source
   │
   ▼
review changes
   │
   ▼
apply selected updates
```

---

# 5. Update must never blindly overwrite

Consumer-owned model-ийн хамгийн чухал дүрэм:

> Registry update ≠ package replacement.

Жишээ:

```text
registry/project-card.astro
consumer/project-card.astro
```

Consumer өөрчлөлт хийсэн бол Grove түүнийг overwrite хийхгүй.

Update flow:

```bash
grove update
```

output:

```text
✓ badge                     safe update
✓ search-field              safe update

! project-card              locally modified
! header                    locally modified

+ collection-sidebar        new component
```

Дараа нь:

```text
review / diff / merge
```

хэлбэрээр ажиллана.

Энэ нь shadcn philosophy-той хамгийн их нийцнэ.

---

# 6. Registry metadata

Consumer project ямар version-ын scaffold авсныг Grove мэддэг байх хэрэгтэй.

Жишээ:

```json
{
  "scaffold": "default",
  "version": "0.4.0",
  "files": {
    "ui/button": "...hash...",
    "grove/project-card": "...hash..."
  }
}
```

Жишээ location:

```text
.grove/registry.json
```

Энэ metadata-аар:

```text
unchanged
locally modified
upstream changed
new
removed
```

ялгана.

---

# 7. Components must become actually standard

"Shadcn compatible" гэдэг нь зөвхөн registry.json гаргахыг хэлэхгүй.

Component architecture хүртэл standard болох хэрэгтэй.

Current Grove-д:

```text
UI primitive
domain component
page component
business logic
filter logic
view transformation
```

хоорондоо заримдаа холилдож байна.

vNext дээр strict boundary тавина.

---

# 8. Four clear layers

## Layer 1 — Core domain

```text
@grove-dev/core
```

Contains:

```text
schemas
taxonomy
search logic
ranking
filters
collections
data transformations
validation
repository metadata
domain types
```

NO:

```text
Astro
HTML
CSS
Tailwind
DOM assumptions
```

---

## Layer 2 — Astro application logic

```text
@grove-dev/astro
```

Contains:

```text
Astro integration
server helpers
route helpers
view-model builders
SEO helpers
generated-data access
```

NO visual components.

Example:

```ts
const model = buildProjectPageModel(project)
```

---

# 9. View model is the UI boundary

UI raw Grove entities render хийхгүй байх нь хамгийн зөв.

Bad:

```astro
<ProjectCard project={rawProject} config={config} />
```

Good:

```ts
const card = buildProjectCardModel(project);
```

returns:

```ts
interface ProjectCardModel {
  title: string;
  description: string;
  href: string;
  image?: string;

  metadata: {
    stars?: string;
    license?: string;
    language?: string;
  };

  tags: Array<{
    label: string;
    href?: string;
  }>;
}
```

UI:

```astro
<ProjectCard project={card} />
```

---

# 10. Registry components contain presentation only

Example:

```astro
---
import Badge from "@/components/ui/badge.astro";

interface Props {
  project: ProjectCardModel;
}

const { project } = Astro.props;
---

<article>
  <a href={project.href}>
    <h3>{project.title}</h3>
    <p>{project.description}</p>
  </a>

  {
    project.tags.map((tag) => (
      <Badge>{tag.label}</Badge>
    ))
  }
</article>
```

Энд:

```text
GitHub API
ranking
score calculation
license normalization
collection resolving
taxonomy matching
```

байх ёсгүй.

---

# 11. No business logic inside UI

Strict rule:

### Forbidden

```astro
---
const stars = project.github.stargazers_count;

const trending =
  stars > 1000 &&
  project.updatedAt > someDate;

const category = normalizeCategory(...);

const sortedTags = calculateTags(...);
---
```

### Correct

```astro
---
const { project } = Astro.props;
---
```

Бүх calculation өмнө хийгдсэн байна.

---

# 12. UI components should be dumb

Ideal UI component:

```text
Props
 ↓
Markup
 ↓
Events / presentation interaction
```

Not:

```text
Props
 ↓
fetch data
 ↓
transform data
 ↓
apply business rules
 ↓
render
```

---

# 13. Client-side UI logic is still allowed

"Business logic UI-аас сална" гэдэг нь client-side behavior байхгүй гэсэн үг биш.

UI-д байж болно:

```text
drawer open/close
dropdown
keyboard navigation
theme toggle
tabs
search input state
responsive navigation
focus handling
```

Харин:

```text
ranking rules
search scoring
taxonomy rules
collection membership
project qualification
SEO rules
content transformation
```

UI-д байж болохгүй.

---

# 14. Search example

Bad:

```text
DirectoryIndexClient.astro
├─ reads generated projects
├─ performs taxonomy filtering
├─ ranking
├─ search
├─ query parsing
├─ renders cards
└─ controls drawer
```

Target:

```text
@grove/core/search
        │
        ▼
@grove/astro/server
        │
        ▼
DirectoryModel
        │
        ▼
local directory-page.astro
        │
        ├── SearchField
        ├── FilterBar
        └── ProjectGrid
```

Client behavior шаардлагатай бол:

```text
search-controller.ts
```

гэсэн presentation controller/local helper болгон тусгаарлаж болно.

Гэхдээ domain algorithm core дээр байна.

---

# 15. Pages must also be consumer owned

Үндсэн scaffold:

```text
src/pages/
```

бүх route-аа агуулна.

Page:

```astro
---
import DirectoryPage from "@/components/grove/directory-page.astro";
import { buildDirectoryPage } from "@grove-dev/astro/server";

const model = await buildDirectoryPage(Astro.url);
---

<DirectoryPage {...model} />
```

Page architecture consumer-д ил харагдана.

---

# 16. Layout ownership

Likewise:

```text
src/layouts/base-layout.astro
src/components/site/header.astro
src/components/site/footer.astro
```

Consumer-owned.

`@grove-dev/astro/layouts` байхгүй болно.

---

# 17. Styles are consumer-owned

Required Grove runtime stylesheet-ийг аль болох арилгана.

Target:

```text
src/styles/global.css
```

registry-аас install болно.

Contains:

```text
design tokens
Tailwind theme
light/dark theme
typography
radius
base styles
```

Хэрэглэгч шууд засна.

---

# 18. Component naming standard

Current naming mixed байж болохгүй:

```text
Card
CardGrid
ProjectCard
CollectionIndex
CollectionPage
DirectoryIndexClient
```

Component taxonomy тодорхой болно.

### primitives

```text
ui/button.astro
ui/badge.astro
ui/input.astro
ui/sheet.astro
```

### domain UI

```text
grove/project-card.astro
grove/collection-card.astro
grove/project-grid.astro
grove/filter-bar.astro
```

### compositions

```text
grove/directory-page.astro
grove/project-detail.astro
grove/collection-detail.astro
```

### site

```text
site/header.astro
site/footer.astro
```

---

# 19. `grove init` final behavior

Ideal:

```bash
grove init
```

does:

```text
Detect Astro
     ↓
Install Grove packages
     ↓
Create grove.config.ts
     ↓
Initialize content/data
     ↓
Install official Grove scaffold from registry
     ↓
Create Grove registry state
     ↓
Validate
```

Хэрэглэгчийн мэдрэмж:

```text
one command
→ complete website
```

Implementation:

```text
minimal CLI
→ registry does the UI distribution
```

Энэ хоёр хоорондоо зөрчилдөхгүй.

---

# 20. `grove update`

Primary update command:

```bash
grove update
```

Responsibilities:

```text
check latest registry
compare installed registry state
detect local modifications
show upstream differences
apply safe updates
preserve custom changes
```

Optional:

```bash
grove update --check
```

```bash
grove update --diff
```

```bash
grove update --force
```

гэж хөгжүүлж болно.

---

# 21. Package updates and UI updates are independent

This is important.

### Engine

```bash
pnpm update @grove-dev/core @grove-dev/astro
```

### UI

```bash
grove update
```

Ингэснээр:

```text
Grove engine release
```

болон:

```text
Grove default UI release
```

нэг lifecycle-д хүчээр холбогдохгүй.

---

# 22. Strong architecture invariant

Grove repo дээр test хийж болно:

### Registry UI may import:

```text
@grove-dev/core/types
@grove-dev/astro/server models
local UI
local utilities
```

### Registry UI must not import:

```text
@grove-dev/astro/components
@grove-dev/astro/ui
@grove-dev/astro/layouts
```

Учир нь тийм runtime UI modules байх ч хэрэггүй.

---

# 23. Another useful invariant

`packages/astro` дотор:

```text
.astro
```

visual component байхгүй болгохыг target болгож болно.

Conceptually:

```text
packages/core
→ pure domain TS

packages/astro
→ Astro integration/server TS

registry
→ Astro UI source
```

Энэ бол маш цэвэр boundary.

---

# 24. Testing architecture

## Core tests

```text
domain correctness
search
taxonomy
ranking
validation
```

## Astro package tests

```text
integration
view models
SEO
generated data
```

## Registry tests

```text
compile
accessibility
expected markup
dependency completeness
no forbidden imports
```

## Example app

Canonical integration test:

```text
apps/example
```

registry scaffold-аа яг consumer шиг install хийж ажиллуулна.

---

# 25. Migration order

### Phase 1

Одоогийн бүх UI/component inventory гаргах.

Тус бүрийг:

```text
domain
view-model
primitive
component
composition
layout
```

гэж classify хийх.

### Phase 2

Business logic-ийг components-аас гаргаж:

```text
core
astro/server
```

руу шилжүүлэх.

### Phase 3

Canonical registry structure байгуулах.

### Phase 4

Current UI-г шинэ standard-аар registry руу migrate хийх.

### Phase 5

`apps/example`-ийг registry-installed scaffold болгох.

### Phase 6

`grove init`-ийг registry bootstrapper болгон хөнгөрүүлэх.

### Phase 7

`grove update` diff/update mechanism хийх.

### Phase 8

Runtime UI exports deprecate/remove хийх.

---

# Final architecture

```text
                      GROVE
                        │
            ┌───────────┴───────────┐
            │                       │
       Engine packages         UI registry
            │                       │
            │                       │
     @grove-dev/core         default scaffold
     @grove-dev/astro        components
            │                layouts
            │                styles
            │                pages
            │                       │
            └──────────┬────────────┘
                       ▼
                Consumer project
                       │
              owns all UI source
```

## Grove owns

```text
domain contracts
business rules
data generation
search
ranking
taxonomy
SEO
view models
registry upstream
upgrade metadata
```

## Consumer owns

```text
pages
layouts
components
markup
styles
design tokens
branding
presentation behavior
```

## Final rule

> **Business logic is imported. UI source is installed.**

Энэ өгүүлбэр Grove vNext-ийн architecture-г бараг бүхэлд нь тодорхойлно.
