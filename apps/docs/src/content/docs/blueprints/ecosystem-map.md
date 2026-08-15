---
title: Ecosystem map
description: The ecosystem-map blueprint — for cataloguing organizations, people, and groups in a domain.
---

The **ecosystem map** blueprint (`kind: ecosystem-map`) is for spaces that catalog *entities* — companies, projects, foundations, working groups, maintainers — rather than discrete resources or repositories. Entries are typically richer in relational metadata (affiliations, locations, links to other entities) than in URLs.

## When to use it

Choose `ecosystem-map` when your space answers one of:

- *“Who are the major players in this space?”*
- *“Which organizations contribute to this ecosystem?”*
- *“I want a directory of maintainers, foundations, and companies.”*

Common use cases: open-source foundation directories, industry maps, maintainer catalogues, venture-fund landscapes, geographic tech communities.

## Schema

An entity record (`data/records/<slug>.yml`):

```yaml
kind: ecosystem-map
slug: cncf
title: "Cloud Native Computing Foundation"
url: https://www.cncf.io/
description: The vendor-neutral home of Kubernetes, Prometheus, Envoy, and other cloud-native projects.
visibility: keep
taxonomy:
  categories: [foundation]
  platforms: [cloud, kubernetes]
entity:
  type: organization
  foundedAt: 2015-07-21
  headquarters: San Francisco, CA
  homepage: https://www.cncf.io
  members:
    - slug: kubernetes
      role: graduated-project
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `kind` | `"ecosystem-map"` | Discriminator. |
| `slug` | string | URL-safe identifier. |
| `title` | string | Display name. |
| `url` | URL | Canonical URL. |
| `description` | string | One-paragraph summary. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `visibility` | `"keep"` \| `"hide"` | Curator override. |
| `taxonomy` | object | Map of taxonomy-name → list of slugs. |
| `entity` | object | Type, foundedAt, members, etc. |
| `images` | object | Logo, headshots. |
| `scores` | object | Influence, size, reach. |
| `topics` | string[] | Free-form tags. |

## Differences from other blueprints

| Aspect | `project-directory` | `resource-hub` | `ecosystem-map` |
|---|---|---|---|
| Item type | Open-source project | Resource (article, video, tool) | Organization / person / group |
| Primary URL | Repository | Resource | Entity homepage |
| JSON-LD type | `SoftwareSourceCode` | `CreativeWork` | `Organization` / `Person` |
| GitHub sync | Auto | No | Only if linked project |
| Lens emphasis | Activity, adoption | Quality, depth | Influence, reach |

## Generated outputs

Same artifact set as the other blueprints, but JSON-LD type is `Organization` or `Person` per record.

## Related

- [Project directory blueprint](/blueprints/project-directory/)
- [Resource hub blueprint](/blueprints/resource-hub/)
- [Author a record](/sources/records/)