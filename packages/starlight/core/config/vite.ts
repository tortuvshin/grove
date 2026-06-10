import type { ViteUserConfig } from 'astro';
import type { GroveStarlightConfig } from './schemas';

export function vitePlugin(config: GroveStarlightConfig): VitePlugin {
    const moduleId = 'virtual:@grove-dev/starlight-config';
    const resolvedModuleId = `\0${moduleId}`;
    const moduleContent = `export default ${JSON.stringify(config)}`;

    return {
        name: 'vite-plugin-grove-dev-starlight',
        load(id) {
            return id === resolvedModuleId ? moduleContent : undefined;
        },
        resolveId(id) {
            return id === moduleId ? resolvedModuleId : undefined;
        },
    };
}

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number];
