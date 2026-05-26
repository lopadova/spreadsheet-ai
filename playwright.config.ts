import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;
const baseURL = `http://127.0.0.1:${PORT}`;

// NOTE: e2e expects built Vite assets. Run `npm run build` before `npm run e2e`.
// As of M3 the `/` page fetches `/api/reviews/{preset}`, so the DB MUST be seeded
// first: `php artisan migrate:fresh --seed` (Herd PHP). Playwright auto-starts
// `artisan serve` on 127.0.0.1:8123 but does not seed for you.
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
