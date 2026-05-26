import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;
const baseURL = `http://127.0.0.1:${PORT}`;

// NOTE: e2e expects built Vite assets. Run `npm run build` before `npm run e2e`.
// The `/` route renders a static Blade shell + React and does NOT touch the DB,
// so e2e is independent of backend migrations/seeders.
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
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
        command: `node scripts/run-php.mjs artisan serve --host=127.0.0.1 --port=${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
