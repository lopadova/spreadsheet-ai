import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;
const baseURL = `http://127.0.0.1:${PORT}`;

// NOTE: e2e expects built Vite assets. Run `npm run build` before `npm run e2e`.
export default defineConfig({
    testDir: './tests/e2e',
    // SSE streams block the single `artisan serve` PHP worker for the duration
    // of a generation run; concurrent specs would starve that worker. Serialise
    // (one worker) so each test's stream owns the worker. Cheap for a demo.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: `node scripts/run-e2e-server.mjs ${PORT}`,
        url: baseURL,
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
        timeout: 120_000,
    },
});
