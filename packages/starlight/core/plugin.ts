import type { StarlightPlugin } from '@astrojs/starlight/types';
import { expressiveCode } from './config/expresive-code';
import { COMPONENT_OVERRIDES, override } from './config/override';
import {
  type GroveStarlightConfig,
  GroveStarlightConfigSchema,
  type GroveStarlightUserConfig,
} from './config/schemas';
import { vitePlugin } from './config/vite';

const parseConfig = (userConfig?: GroveStarlightUserConfig): GroveStarlightConfig => {
  const parsedConfig = GroveStarlightConfigSchema.safeParse(userConfig ?? {});

  if (!parsedConfig.success) {
    throw new Error(
      `The provided plugin configuration for grove-starlight is invalid.\n${parsedConfig.error.issues.map((issue) => issue.message).join('\n')}`,
    );
  }

  return parsedConfig.data;
};

const plugin = (userConfig: GroveStarlightUserConfig = {}): StarlightPlugin =>
  ({
    name: 'grove-starlight',
    hooks: {
      'config:setup': ({ config, logger, updateConfig, addIntegration }) => {
        const pluginConfig = parseConfig(userConfig);

        updateConfig({
          components: override(config, pluginConfig, COMPONENT_OVERRIDES, logger),
          customCss: [
            ...(config.customCss ?? []),
            '@grove-dev/starlight/styles/layers',
            '@grove-dev/starlight/styles/theme',
            '@grove-dev/starlight/styles/base',
          ],
          expressiveCode: expressiveCode(config),
        });

        addIntegration({
          name: 'grove-starlight-integration',
          hooks: {
            'astro:config:setup': ({ updateConfig }) => {
              updateConfig({
                vite: { plugins: [vitePlugin(pluginConfig)] },
              });
            },
          },
        });
      },
      // 'i18n:setup': function ({ injectTranslations }) {
      //     injectTranslations(translations);
      // },
    },
  }) satisfies StarlightPlugin;

export { plugin };
