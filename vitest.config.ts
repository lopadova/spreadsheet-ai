import { defineConfig, type ViteUserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `react()` targets Vite 8 (rolldown) while Vitest bundles Vite 7 (rollup);
// the runtime is compatible, but the Plugin types diverge — cast to satisfy tsc.
const plugins = [react()] as unknown as ViteUserConfig['plugins'];

export default defineConfig({
    plugins,
    test: {
        environment: 'jsdom',
        globals: true,
        pool: 'threads',
        setupFiles: ['./tests/js/setup.ts'],
        include: ['tests/js/**/*.{test,spec}.{ts,tsx}'],
        css: false,
    },
});
