---
title: Security
description: The security policy for Grove — supported versions, how to report a vulnerability, what data is and is not collected.
---

This page documents the security posture of the Grove framework and the
`@grove-dev/*` packages. If you maintain a *Grove-powered directory*,
the same policy applies to your directory, with the maintainer team as
the contact point. The complete policy lives in
[`SECURITY.md`](https://github.com/tortuvshin/grove/blob/main/SECURITY.md)
at the repo root; this page is the summary.

## Supported versions

The four published packages (`@grove-dev/core`, `@grove-dev/cli`,
`@grove-dev/astro`, `@grove-dev/starlight`) follow a single support
window:

| Version          | Supported                                          |
| ---------------- | -------------------------------------------------- |
| `latest`         | Active fixes + backports                           |
| Previous minor   | Critical fixes only, for 30 days after a new minor |
| Older            | No fixes — please upgrade                          |

In practice this means: if you're on `0.4.0` and `0.5.0` ships, you
have 30 days of critical-only support on `0.4.0` before you should
upgrade. After 30 days, you're on your own.

To check which version your space is on:

```bash
pnpm ls -r --depth=-1 | grep "@grove-dev"
```

The output lists the installed version of every `@grove-dev/*` package
in your workspace.

## What counts as a vulnerability

Three categories, in decreasing order of severity:

1. **Code execution from data.** A malicious YAML record, a malicious
   markdown body, or a malicious URL in a record field that escapes
   the sandbox of a Grove space. This is the highest-priority class.
2. **Build-time compromise.** A vulnerability in the CLI or a build
   step that allows a malicious record to compromise the developer
   machine or the CI runner.
3. **Information disclosure.** A vulnerability that leaks data the
   user did not intend to expose.

The framework is designed so that category 1 is hard. Records are
parsed via Zod, not `eval`; URLs are passed through to the framework's
link renderer; markdown bodies are rendered by a hardened pipeline.
If you find a way around any of these, that's a category-1 report.

## Reporting a vulnerability

**Do not file a public issue.** Public disclosure before a fix is
ready makes every Grove-powered space on the internet a target.

Report privately by email to:

> **toroo.byamba@gmail.com**

Include, where possible:

1. The affected package and version (e.g., `@grove-dev/cli@0.4.0`).
2. A minimal reproduction — the smallest `grove.config.ts` + data +
   command that triggers the issue. A failing test case is even
   better.
3. The expected behaviour and the actual behaviour.
4. Whether the issue is exploitable from untrusted input (a forked
   data file, a third-party resource record, a user-submitted PR).
5. Your contact info for follow-up questions.

PGP-encrypted reports are not currently supported. The email is
monitored by a maintainer; an out-of-band response is sent within 72
hours.

## What to expect after a report

- **Acknowledgement** within **72 hours** of the report.
- **Triage** within **7 days**: confirm, scope, decide on a fix plan.
- **Fix** for critical issues as fast as we can responsibly ship.
- **Coordinated disclosure** — the maintainer team agrees on a
  disclosure date with you.
- **Credit** in the release notes (`CHANGELOG.md`) and the GitHub
  Security Advisory, unless you'd rather stay anonymous.

## What is in scope

- **Any vulnerability in an `@grove-dev/*` package** that can be
  triggered by data in `data/`, a CLI command, a build step, or a
  runtime adapter.
- **Issues that allow a malicious data record to escape the sandbox**
  of a Grove space.
- **Supply-chain issues** in the published packages' dependency tree.

## What is out of scope

- **Documentation typos and broken links.** Open a regular issue.
- **Performance improvements** that don't have a security angle.
- **The example application at `apps/example/`.** That is illustrative
  and not covered by the security policy.
- **Vulnerabilities in third-party templates** (a downstream user's
  custom Astro template, for example).

## What data Grove does (and does not) collect

Grove is a build-time tool. It does not phone home, log analytics, or
collect telemetry. The only network calls the CLI makes are:

1. **To the GitHub API** (`api.github.com`) — during
   `grove sync github`. The call uses the token resolved from
   `GITHUB_TOKEN` or `gh auth token`.
2. **To `registry.npmjs.org`** — when you run `pnpm publish` (via
   the release script). The framework itself does not initiate this.
3. **To the host of any URL in a record's `links`** — when the
   rendered page is loaded in a browser.

A built site has no JavaScript that phones home unless the user adds
it. The Astro template's `BaseLayout.astro` ships with no third-party
scripts by default; any analytics integration is the user's choice.

## Safe-harbour

The maintainer team will not pursue legal action against security
researchers who, in good faith, follow this policy: make a reasonable
effort to avoid privacy violations, destruction of data, and
interruption of services, and stop testing immediately if they
confirm a vulnerability.

## Past advisories

Public security advisories are listed at
[GitHub Security Advisories for this repo](https://github.com/tortuvshin/grove/security/advisories).
The list is empty in v0.4.0; it is the right place to look if you
want to confirm a CVE.

## For directory maintainers

If you maintain a Grove-powered directory and want to mirror this
policy:

1. **Set up a private contact channel.** The framework uses email; a
   directory can use email, a security@ mailbox, or a GitHub Security
   Advisory. The point is *private* and *monitored*.
2. **Define a support window.** The 30-day critical-fix window above
   is a reasonable default.
3. **Tell your contributors.** Link the policy from your `README` and
   your submission page.
4. **Have a back-up maintainer.** If the security contact is one
   person, an outage on their end is a vulnerability report with no
   acknowledgement.