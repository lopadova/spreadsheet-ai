import { expect, test, type Page } from '@playwright/test';

// ============================================================
// M5 — interactions: column editor, add/AI-suggest/delete columns, cell
// side-panel, bulk regenerate.
//
// Canvas note (same as grid.spec): Glide draws to <canvas>; we drive and assert
// through the screen-reader-available MIRROR <table> (data-testid="grid-mirror")
// which also exposes keyboard-accessible affordances:
//   edit-col-{index}, open-cell-{rowId}-{index}, select-col-{index}.
// SSE owns the single PHP worker, so these run serial (config workers:1).
// ============================================================

const MIRROR = '[data-testid="grid-mirror"]';

test.describe.configure({ mode: 'serial' });

async function filledCount(page: Page): Promise<number> {
    const txt = await page.getByTestId('mirror-filled-count').textContent();
    return Number.parseInt(txt ?? '0', 10);
}

/** Run all and wait for the returns grid to fully fill (14×8 = 112 cells). */
async function runAllReturns(page: Page): Promise<void> {
    await page.goto('/');
    await expect(page.locator(MIRROR)).toBeAttached();
    await page.getByRole('button', { name: /Run all/i }).click();
    await expect.poll(() => filledCount(page), { timeout: 30_000 }).toBe(112);
    await expect(page.getByRole('button', { name: /Run all/i })).toBeVisible();
}

test.describe('Column editor (M5.1)', () => {
    test('edit an AI column → drawer prefilled → change prompt → Save & regenerate re-streams', async ({
        page,
    }) => {
        await runAllReturns(page);

        // Open the editor for the "Cliente seriale?" column (index 1).
        await page.getByTestId('edit-col-1').dispatchEvent('click');
        const drawer = page.getByTestId('column-editor');
        await expect(drawer).toBeVisible();
        await expect(drawer.getByLabel('Label')).toHaveValue(/seriale/i);
        await expect(drawer.getByTestId('ce-format')).toHaveText('yes_no');

        // Change the prompt and save.
        await drawer.getByLabel('Prompt').fill('Il cliente ha più di 3 resi negli ultimi 12 mesi? (aggiornato)');
        await drawer.getByRole('button', { name: /Save & regenerate/i }).click();
        await expect(drawer).toBeHidden();

        // That column re-streams: it goes through generating then back to ready
        // values (yes_no renders "Yes"/"No"). Assert a known row settles.
        await expect(page.getByTestId('cell-RET-1042-1')).toHaveText(/Yes|No/, { timeout: 30_000 });
    });
});

test.describe('Add / AI Suggest / delete column (M5.2)', () => {
    test('Add column → pick format → prompt → Save → a new column appears and fills', async ({
        page,
    }) => {
        await runAllReturns(page);

        const before = await page.locator(`${MIRROR} thead th[data-format]`).count();

        await page.getByRole('button', { name: /Add column/i }).click();
        const drawer = page.getByTestId('column-editor');
        await expect(drawer).toBeVisible();
        await drawer.getByLabel('Label').fill('Sentiment cliente');
        await drawer.getByRole('button', { name: /^Text/i }).click();
        await drawer.getByLabel('Prompt').fill('Determina il sentiment del cliente dal motivo del reso.');
        await drawer.getByRole('button', { name: /Save & regenerate/i }).click();
        await expect(drawer).toBeHidden();

        // A new AI column header appears.
        await expect
            .poll(async () => page.locator(`${MIRROR} thead th[data-format]`).count(), { timeout: 15_000 })
            .toBe(before + 1);

        // Its cells fill (new column index = `before` ordinal among AI cols).
        const newIdx = before;
        await expect(page.getByTestId(`cell-RET-1042-${newIdx}`)).not.toHaveText('', { timeout: 30_000 });
    });

    test('AI Suggest → pick a suggestion → new column appears and fills', async ({ page }) => {
        await runAllReturns(page);

        const before = await page.locator(`${MIRROR} thead th[data-format]`).count();

        await page.getByRole('button', { name: /AI Suggest/i }).click();
        const menu = page.getByRole('menu', { name: /AI suggested columns/i });
        await expect(menu).toBeVisible();
        await menu.getByRole('menuitem').first().click();

        await expect
            .poll(async () => page.locator(`${MIRROR} thead th[data-format]`).count(), { timeout: 15_000 })
            .toBe(before + 1);

        const newIdx = before;
        await expect(page.getByTestId(`cell-RET-1042-${newIdx}`)).not.toHaveText('', { timeout: 30_000 });
    });

    test('delete a column from the editor → it disappears', async ({ page }) => {
        await runAllReturns(page);

        const before = await page.locator(`${MIRROR} thead th[data-format]`).count();

        // Auto-accept the confirm() dialog.
        page.on('dialog', (d) => d.accept());

        // Delete the last AI column (index = before - 1).
        const lastIdx = before - 1;
        await page.getByTestId(`edit-col-${lastIdx}`).dispatchEvent('click');
        const drawer = page.getByTestId('column-editor');
        await expect(drawer).toBeVisible();
        await drawer.getByRole('button', { name: /Delete column/i }).click();

        await expect
            .poll(async () => page.locator(`${MIRROR} thead th[data-format]`).count(), { timeout: 15_000 })
            .toBe(before - 1);
    });
});

test.describe('Cell side-panel (M5.3)', () => {
    test('click a filled cell → panel opens with value + citation + Regenerate', async ({ page }) => {
        await runAllReturns(page);

        // Open the side-panel for an enum cell (index 0 → "Wrong Size").
        await page.getByTestId('open-cell-RET-1042-0').dispatchEvent('click');
        const panel = page.getByTestId('cell-side-panel');
        await expect(panel).toBeVisible();
        await expect(panel.getByTestId('cp-value')).not.toHaveText('');
        await expect(panel.getByTestId('cp-citations')).toBeVisible();
        await expect(panel.getByRole('button', { name: /Regenerate/i })).toBeVisible();

        // Regenerate just this column re-streams it.
        await panel.getByRole('button', { name: /Regenerate/i }).click();
        await expect(page.getByTestId('cell-RET-1042-0')).toHaveText('Wrong Size', { timeout: 30_000 });

        await panel.getByRole('button', { name: /Close panel/i }).click();
        await expect(panel).toBeHidden();
    });
});

test.describe('Bulk regenerate (M5.3)', () => {
    test('select multiple columns → bulk toolbar → Regenerate selected re-streams them', async ({
        page,
    }) => {
        await runAllReturns(page);

        // Select two AI columns (index 0 + 3).
        await page.getByTestId('select-col-0').dispatchEvent('click');
        await page.getByTestId('select-col-3').dispatchEvent('click');

        const toolbar = page.getByTestId('bulk-toolbar');
        await expect(toolbar).toBeVisible();
        await expect(toolbar).toContainText(/2 colonne selezionate/i);

        await toolbar.getByRole('button', { name: /Regenerate/i }).click();

        // Both selected columns re-stream back to their values.
        await expect(page.getByTestId('cell-RET-1042-0')).toHaveText('Wrong Size', { timeout: 30_000 });
        await expect(page.getByTestId('cell-RET-1042-3')).toHaveText('1/5', { timeout: 30_000 });

        // Clear selection hides the toolbar.
        await page.getByTestId('select-col-0').dispatchEvent('click');
        await page.getByRole('button', { name: /Clear selection/i }).click();
        await expect(toolbar).toBeHidden();
    });
});
