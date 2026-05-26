import { expect, test } from '@playwright/test';

test('homepage mounts the React foundation', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#root')).toBeAttached();
    await expect(
        page.getByRole('heading', { name: /Tabular Review — foundation ready/i }),
    ).toBeVisible();
});
