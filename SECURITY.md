# Security Policy

## Supported versions

Grove's six published packages (`@grove-dev/core`, `@grove-dev/ui`, `@grove-dev/cli`, `@grove-dev/astro`, `@grove-dev/nextjs`, `@grove-dev/svelte`) follow the same support window:

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅ Active fixes + backports |
| previous minor | ⚠️ Critical fixes only for 30 days after a new minor release |
| older   | ❌ No fixes — please upgrade |

If you're unsure which version your space is on, run `pnpm ls -r --depth=-1` from your space's repo root and look for the `@grove-dev/*` lines.

## Reporting a vulnerability

**Please do not file a public issue.** Public disclosure before a fix is ready makes every Grove-powered space on the internet a target.

Report privately by email to:

> **toroo.byamba@gmail.com**

Include, where possible:

1. The affected package and version (e.g. `@grove-dev/cli@0.2.2`).
2. A minimal reproduction — the smallest `grove.config.ts` + data + command that triggers the issue.
3. The expected behaviour and the actual behaviour.
4. Whether the issue is exploitable from untrusted input (a forked data file, a third-party resource record, a user-submitted PR).
5. Your contact info for follow-up questions. If you'd like to be credited in the release notes, say so.

You can optionally encrypt the report with PGP — see [`docs/SUPPORT.md`](./docs/SUPPORT.md#contact) for a public key fingerprint if we publish one in the future.

## What to expect

- **Acknowledgement** within **72 hours** of the report.
- **Triage** within **7 days**: confirm, scope, decide on a fix plan.
- **Fix** for critical issues as fast as we can responsibly ship — typically days, occasionally a week or two if the fix has migration implications.
- **Coordinated disclosure** — we'll agree on a disclosure date with you so you can publish your own write-up at the same time, if relevant.
- **Credit** in the release notes (`CHANGELOG.md`) and the GitHub Security Advisory, unless you'd rather stay anonymous.

## Scope

In scope:

- Any vulnerability in `@grove-dev/*` packages that can be triggered by data in `data/`, a CLI command, a build step, or a runtime adapter.
- Issues that allow a malicious data record to escape the sandbox of a Grove space (e.g. a YAML deserialization flaw in `@grove-dev/core`).
- Supply-chain issues in the published packages' dependency tree.

Out of scope (please open a regular issue):

- Documentation typos and broken links.
- Performance improvements that don't have a security angle.
- The example spaces under `examples/` — those are illustrative and not covered by the security policy.

## Safe-harbour

We will not pursue legal action against security researchers who, in good faith, follow this policy: make a reasonable effort to avoid privacy violations, destruction of data, and interruption of our services, and stop testing immediately if they confirm a vulnerability.

## Past advisories

See [GitHub Security Advisories for this repo](https://github.com/tortuvshin/grove/security/advisories) for the public list.
