---
title: "Install the CLI"
description: "Prerequisites and one-time setup for the @grove-dev/cli toolchain."
---

# Install the CLI

> TODO — written in Batch 4.

## Prerequisites

- Node `>=22.12.0`
- pnpm `10.12.1` (or a compatible Node package manager)

The CLI is published as `@grove-dev/cli`. You can run it directly with `pnpm dlx`:

```bash
pnpm dlx @grove-dev/cli@latest init my-space
```

Or install it globally and use the binary name `grove`:

```bash
pnpm add -g @grove-dev/cli
grove --help
```

The first scaffold command is `grove init`. See `getting-started/scaffold` for the full walkthrough.
