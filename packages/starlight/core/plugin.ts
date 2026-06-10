import type { StarlightPlugin } from '@astrojs/starlight/types';
import tailwindcss from '@tailwindcss/vite';
import { override, COMPONENT_OVERRIDES } from './config/override';
import { expressiveCode } from './config/expresive-code';
import { vitePlugin } from './config/vite';
import {
    GroveStarlightConfigSchema,
    type GroveStarlightConfig,
    type GroveStarlightUserConfig,
} from './config/schemas';

const parseConfig = (userConfig?: GroveStarlightUserConfig): GroveStarlightConfig => {
    const parsedConfig = GroveStarlightConfigSchema.safeParse(userConfig ?? {});

    if (!parsedConfig.success) {
        throw new Error(
            `The provided plugin configuration for @grove-dev/starlight is invalid.\n${parsedConfig.error.issues.map((issue) => issue.message).join('\n')}`
        );
    }

    return parsedConfig.data;
};

const plugin = (userConfig?: GroveStarlightUserConfig): StarlightPlugin =>
    ({
        name: '@grove-dev/starlight',
        hooks: {
            'config:setup': ({ config, logger, updateConfig, addIntegration }) => {
                updateConfig({
                    components: override(config, COMPONENT_OVERRIDES, logger),
                    customCss: [
                        ...(config.customCss ?? []),
                        // Only the Tailwind-driven theme.css is needed. The
                        // `base` and `layers` styles are re-exports for
                        // backwards compatibility and remain empty.
                        '@grove-dev/starlight/styles/theme',
                    ],
                    expressiveCode: expressiveCode(config),
                });

                addIntegration({
                    name: '@grove-dev/starlight-integration',
                    hooks: {
                        'astro:config:setup': ({ updateConfig }) => {
                            updateConfig({
                                vite: {
                                    plugins: [
                                        // Wire up Tailwind v4 for any source
                                        // file in the consumer project (the
                                        // docs site). It will scan every
                                        // component that the theme overrides
                                        // for utility classes.
                                        tailwindcss(),
                                        vitePlugin(parseConfig(userConfig)),
                                    ],
                                },
                            });
                        },
                    },
                });
            },
        },
    }) satisfies StarlightPlugin;

export { plugin };
