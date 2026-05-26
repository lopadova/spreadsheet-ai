import { expect, test, type Page } from '@playwright/test';

// ============================================================
// M4 — Glide grid + live SSE streaming.
//
// Canvas testing approach: Glide renders cells to <canvas>, which Playwright
// cannot query for text. AgenticGrid therefore renders a visually-hidden but
// screen-reader-available MIRROR <table> (data-testid="grid-mirror") that
// reflects the live cell store. We assert against the mirror; the canvas
// remains the visual surface. This doubles as an accessibility improvement.
// ============================================================

const MIRROR = '[data-testid="grid-mirror"]';

// SSE monopolises the single `artisan serve` PHP worker for the duration of a
// run; running these streaming tests in parallel starves that worker. Force
// serial execution so each stream gets the worker to itself.
test.describe.configure({ mode: 'serial' });

/** Count of ready (non-empty, non-generating) AI cells from the mirror caption. */
async function filledCount(page: Page): Promise<number> {
    const txt = await page.getByTestId('mirror-filled-count').textContent();
    return Number.parseInt(txt ?? '0', 10);
}

test.describe('Glide grid streaming (M4)', () => {
    test('Run all fills skeletons → values, progress hits 100%, footer citations populate', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.locator(MIRROR)).toBeAttached();

        // Run a generation. (Cells persist in the DB across runs, so we don't
        // assume an empty start; we assert the run transitions through skeletons
        // to the expected values and completes.)
        await page.getByRole('button', { name: /Run all/i }).click();

        // Progress bar appears while running, and at least one cell shows the
        // generating (skeleton) status during the run.
        await expect(page.getByRole('progressbar')).toBeVisible();

        // Cells stream in: an enum pill ("Wrong Size"), a rating, a percentage.
        await expect(page.getByTestId('cell-RET-1042-0')).toHaveText('Wrong Size', { timeout: 30_000 });
        await expect(page.getByTestId('cell-RET-1042-3')).toHaveText('1/5'); // rating column
        await expect(page.getByTestId('cell-RET-1042-5')).toHaveText(/%|\d/); // confidence percentage

        // Generation completes: all 14×8 = 112 cells filled and the run settles
        // (Stop/progress give way to the idle Run-all button).
        await expect.poll(() => filledCount(page), { timeout: 30_000 }).toBe(112);
        await expect(page.getByRole('button', { name: /Run all/i })).toBeVisible();

        // Footer "recent citations" populated from generated cells.
        const citStrip = page.locator('.status-footer-right .cit-strip .cit-chip');
        await expect(citStrip.first()).toBeVisible();
    });

    test('17-format showcase: every AI column renders a value after Run all', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('tab', { name: /Tutti i 16 formati/i }).click();
        await expect(page.locator(MIRROR)).toBeAttached();

        await page.getByRole('button', { name: /Run all/i }).click();

        // 5 rows × 16 AI columns = 80 cells. Wait for full fill.
        await expect.poll(() => filledCount(page), { timeout: 30_000 }).toBe(80);

        // Assert each of the 16 AI columns rendered a non-empty value in row 0.
        const headerFormats = await page.locator(`${MIRROR} thead th[data-format]`).evaluateAll((ths) =>
            ths.map((t) => t.getAttribute('data-format')),
        );
        expect(headerFormats.length).toBe(16);
        for (let col = 0; col < 16; col++) {
            const cell = page.locator(`${MIRROR} tbody tr:first-child [data-testid$="-${col}"]`).first();
            await expect(cell).not.toHaveText('');
        }
    });

    test('preset switch mid-run does not bleed stale cells (run-token guard, §1.A.7)', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.locator(MIRROR)).toBeAttached();

        // Start a run on RETURNS.
        await page.getByRole('button', { name: /Run all/i }).click();
        // As soon as some returns cells appear, switch to FRAUD mid-run.
        await expect(page.getByTestId('cell-RET-1042-0')).toHaveText('Wrong Size', { timeout: 30_000 });
        await page.getByRole('tab', { name: /Frode Ordini/i }).click();

        // Wait for the fraud grid to finish loading (its mirror shows ORD-* rows).
        await expect(page.locator(`${MIRROR} tbody tr[data-row-id^="ORD-"]`).first()).toBeAttached({
            timeout: 15_000,
        });

        // Give any late returns events a moment to (incorrectly) arrive, then
        // assert the run-token guard dropped them: no returns rows, and no
        // returns-only value ("Wrong Size") bled into the fraud grid.
        await page.waitForTimeout(1_500);
        await expect(page.locator(`${MIRROR} tbody tr[data-row-id^="RET-"]`)).toHaveCount(0);
        await expect(page.locator(MIRROR)).not.toContainText('Wrong Size');
    });
});
