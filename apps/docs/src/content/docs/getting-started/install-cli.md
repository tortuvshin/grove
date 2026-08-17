---
title: "Install the CLI"
description: "Prerequisites and one-time setup for the @grove-dev/cli toolchain."
---

# Install the CLI

The Grove CLI (`@grove-dev/cli`) is the single tool you use to scaffold a space, validate records, and sync GitHub metadata. You don't need to install anything permanently — `pnpm dlx` fetches the latest on every run.

## Prerequisites

- Node `>=22.12.0`
- pnpm `10.12.1` (or a compatible Node package manager — npm, yarn, or bun work too)

Verify your environment before continuing:

```bash
node --version    # v22.12.0 or higher
pnpm --version    # 10.12.1 or compatible
corepack enable   # one-time, only if pnpm isn't installed yet
```

If `node --version` is below `22.12.0`, install a newer Node first — see [Troubleshooting](#node-version-is-too-old) below.

## Three install paths

Pick whichever matches your workflow.

### Path A — `pnpm dlx` (recommended; zero install)

Run any command without permanently installing anything. `dlx` fetches the latest CLI on demand and uses a cache for repeat calls.

```bash
pnpm dlx @grove-dev/cli@latest init my-space
```

After this single command, you have a working `my-space/` directory. Every subsequent command is also a `dlx` call:

```bash
pnpm dlx @grove-dev/cli@latest check
pnpm dlx @grove-dev/cli@latest sync github
```

### Path B — Global install

If you'd rather have a persistent `grove` binary on your `PATH`:

```bash
pnpm add -g @grove-dev/cli
grove --help
grove init my-space
```

The binary name is `grove`. All examples in the docs use this form, but every command also works as `pnpm dlx @grove-dev/cli@latest <command>`.

### Path C — `npm`/`npx` (non-pnpm users)

If you don't use pnpm, the same package works through `npx`:

```bash
npx @grove-dev/cli@latest init my-space
```

There's no functional difference. The CLI is published as `@grove-dev/cli` on npm.

## Verify the install

The first scaffold command is `grove init`. Once you've run it (or installed globally), confirm the binary works:

```bash
grove --version
grove --help
```

Expected output (excerpt):

```
grove 0.x.y

Usage: grove <command> [options]

Commands:
  init <name>           Scaffold a new space from the canonical template
  check                 Validate records and regenerate outputs
  sync github           Refresh GitHub metadata for every record
  ...
```

If you see `command not found: grove`, see [Troubleshooting](#command-not-found-grove) below.

## Update the CLI

For `dlx` / `npx` users, the `@latest` tag always fetches the newest version — no update step needed.

For global installs:

```bash
pnpm add -g @grove-dev/cli@latest
```

## Troubleshooting

### `command not found: grove`

The global install put the binary somewhere not on your `PATH`. Find where:

```bash
pnpm bin -g
```

Add the printed directory to your shell `PATH` (usually in `~/.zshrc` or `~/.bashrc`):

```bash
export PATH="$(pnpm bin -g):$PATH"
```

Or just use Path A (`pnpm dlx`) and skip the global install.

### Node version is too old

If you see `engine 'node' is incompatible with this package`, your Node is below `22.12.0`. Install a newer one:

```bash
nvm install 22.12.0   # if you use nvm
nvm use 22.12.0
node --version        # confirm v22.12.0+
```

### `EACCES` on global install

macOS / Linux global installs sometimes hit a permissions error. Two fixes:

1. Use Path A (`pnpm dlx`) — no global install needed.
2. Reconfigure pnpm to install globally under your home directory: `pnpm setup`.

## Next steps

- [Quickstart](/start-here/quickstart/) — the full 5-step path to a working site.
- [Scaffold a space](/getting-started/scaffold/) — what `grove init` actually creates.