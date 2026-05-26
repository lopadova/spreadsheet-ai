import { expect, test } from '@playwright/test';

test.describe('Tabular Review page shell (M3)', () => {
    test('loads hero, 5 preset chips, action bar buttons, and toggles theme', async ({ page }) => {
        await page.goto('/');

        await expect(page.locator('#root')).toBeAttached();
        await expect(page.getByRole('heading', { name: /Ogni colonna/i })).toBeVisible();
        await expect(page.getByText('è un prompt.')).toBeVisible();

        const chips = page.getByRole('tab');
        await expect(chips).toHaveCount(5);

        await expect(page.getByRole('button', { name: /AI Suggest/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Add column/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Run all/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Share/i })).toBeVisible();

        // Theme toggle flips the documentElement data-theme attribute.
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await page.getByRole('button', { name: /Switch to light theme/i }).click();
        await expect(html).toHaveAttribute('data-theme', 'light');
        await page.getByRole('button', { name: /Switch to dark theme/i }).click();
        await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('switching preset chips updates the footer entity count', async ({ page }) => {
        await page.goto('/');

        // returns preset is the default → 14 returns rows.
        const footerBadge = page.locator('.status-footer-left .badge.outline');
        await expect(footerBadge).toHaveText(/14 Resi/);

        // fraud → 10 orders.
        await page.getByRole('tab', { name: /Frode Ordini/i }).click();
        await expect(footerBadge).toHaveText(/10 Ordini/);
        await expect(page.getByRole('tab', { name: /Frode Ordini/i })).toHaveAttribute(
            'aria-selected',
            'true',
        );

        // email → 8 campaigns.
        await page.getByRole('tab', { name: /Audit Campagne/i }).click();
        await expect(footerBadge).toHaveText(/8 Campagne/);

        // formats showcase → 5 examples, 17 AI columns shown in hero.
        await page.getByRole('tab', { name: /Tutti i 16 formati/i }).click();
        await expect(footerBadge).toHaveText(/5 Esempi/);
    });

    test('AI Suggest opens and lists suggestions from the API', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: /AI Suggest/i }).click();
        const menu = page.getByRole('menu', { name: /AI suggested columns/i });
        await expect(menu).toBeVisible();
        // returns preset suggestions include the chargeback proposal.
        await expect(menu.getByRole('menuitem', { name: /chargeback/i })).toBeVisible();
        await expect(menu.getByRole('menuitem')).toHaveCount(3);
    });
});
