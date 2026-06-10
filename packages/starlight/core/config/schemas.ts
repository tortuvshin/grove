import type { AstroBuiltinAttributes } from 'astro';
import type { HTMLAttributes } from 'astro/types';
import { z } from 'astro/zod';

const linkHTMLAttributesSchema = z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.undefined()])
) as z.Schema<Omit<HTMLAttributes<'a'>, keyof AstroBuiltinAttributes | 'children'>>;

const LinkItemHTMLAttributesSchema = () => linkHTMLAttributesSchema.default({});

export const linkSchema = z.object({
    badge: z.string().optional(),
    label: z.union([z.string(), z.record(z.string(), z.string())]),
    link: z.string(),
    attrs: LinkItemHTMLAttributesSchema().optional(),
});

export type Link = z.infer<typeof linkSchema>;

export const GroveStarlightConfigSchema = z.object({
    navLinks: z.array(linkSchema).optional(),
    docs: z
        .object({
            includeAiUtilities: z.boolean().optional().default(false),
        })
        .optional()
        .default({ includeAiUtilities: false }),
    footerText: z
        .string()
        .optional()
        .default(
            'Grove theme for Astro Starlight. Inspired by the [shadcn/ui](https://ui.shadcn.com/) documentation theme and based on [starlight-theme-black](https://github.com/adrian-ub/starlight-theme-black) and [lucode-starlight](https://github.com/lucas-labs/lucode-starlight-theme).'
        ),
});

export type GroveStarlightUserConfig = z.input<typeof GroveStarlightConfigSchema>;
export type GroveStarlightConfig = z.output<typeof GroveStarlightConfigSchema>;
