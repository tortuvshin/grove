# Third-party attributions — `@grove-dev/starlight`

This package incorporates design and code from upstream projects. The
contributions are credited below; reproduction of the upstream license
texts follows the attribution block. The Grove project ships
`@grove-dev/starlight` under the same MIT license that the rest of the
monorepo uses; the third-party license texts below are reproduced here
to satisfy the upstream attribution requirements.

> **⚠️ TODO(decision): license compatibility check.**
> The audit and the project's own README credit the upstream work as
> "lucode / lucas-labs" and reference
> `https://github.com/lucas-labs/@grove-dev/starlight-theme`. Before the
> first publish of `@grove-dev/starlight` to npm, the project owner
> must:
>
> 1. Confirm the exact upstream repo URL (the `lucas-labs/...` path
>    in the README is a placeholder; the real upstream is
>    `lucode-labs/lucode` or similar — verify on GitHub).
> 2. Verify the upstream license (MIT? Apache-2.0? something else?)
>    and confirm it is compatible with the Grove monorepo's MIT
>    distribution.
> 3. If compatible, replace the `<!-- TODO LICENSE TEXT -->` block
>    below with the verbatim upstream license text (most MIT projects
>    use the standard MIT text — the canonical version is at
>    <https://opensource.org/licenses/MIT>).
> 4. If not compatible, either obtain a written license grant from
>    the upstream maintainer OR replace the derivative design with
>    original work before publishing.
>
> Tracking issue:
> <https://github.com/tortuvshin/grove/issues/new?title=starlight%3A+verify+third-party+license+compatibility>

## Upstream credits

The design and component overrides in this package derive from:

- **[lucode](https://github.com/lucas-labs/@grove-dev/starlight-theme)** by the
  **lucas-labs** organization (also referenced as "Lucode" in the
  package's `user-components.ts` and component overrides). The theme
  recreates the design of [shadcn/ui](https://ui.shadcn.com/) (MIT)
  for use inside Astro Starlight, with custom overrides for the
  header, sidebar, page frame, hero, footer, search, table of
  contents, pagination, and Markdown content. See the package
  `README.md` (the "Attribution" and "Usage" sections) for the
  in-code pointers.
- **[adrian-ub/starlight-theme-black](https://github.com/adrian-ub/starlight-theme-black)**
  — the earlier shadcn/ui-inspired Starlight theme that
  `lucas-labs/@grove-dev/starlight-theme` was based on (per the
  upstream README).
- **[shadcn/ui](https://ui.shadcn.com/)** — the original design
  language that the upstream work and this package both target.

## Upstream license

<!-- TODO LICENSE TEXT: paste the verbatim upstream license (typically
the standard MIT text with copyright line) here once the license
compatibility check above is complete. Until then this section is
intentionally empty so the file can ship without misrepresenting the
upstream license. -->

## License for this package

`@grove-dev/starlight` is distributed under the **MIT License** — see
[`../core/LICENSE`](../../LICENSE) at the monorepo root for the
canonical text. The third-party attributions above are reproduced for
compliance with the upstream license terms; they do not change the
license of the rest of the package.
