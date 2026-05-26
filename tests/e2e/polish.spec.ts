import { expect, test, type Page } from '@playwright/test';

// ============================================================
// M6 — polish guardrails: icon-button a11y, no horizontal overflow at desktop
// and emulated 150% zoom, and a real CSV export download.
//
// Canvas note: the grid draws to <canvas>; assertions about cell values go
// through the mirror table. SSE owns the single PHP worker → serial.
// ============================================================

test.describe.configure({ mode: 'serial' });

/** Max horizontal overflow of the scrolling page container, in px. */
async function pageOverflow(page: Page): Promise<number> {
    return page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.page-content');
        if (el == null) return Number.NaN;
        // A few px of sub-pixel rounding tolerance is expected; the caller asserts
        // against a small bound rather than exact equality.
        return el.scrollWidth - el.clientWidth;
    });
}

test.describe('a11y — icon buttons expose accessible names (M6.2)', () => {
    test('key icon-only buttons have an accessible name', async ({ page }) => {
        await page.goto('/');

        // Theme toggle (icon-only) exposes aria-label.
        await expect(page.getByRole('button', { name: /Switch to light theme/i })).toBeVisible();

        // Every <button> has a real accessible name: visible text or aria-label
        // (or aria-labelledby). `title` is a tooltip, NOT a reliable accessible
        // name, so it does NOT count here. Glide's canvas isn't a real <button>.
        const namelessCount = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.filter((b) => {
                const aria = b.getAttribute('aria-label')?.trim();
                const labelledby = b.getAttribute('aria-labelledby')?.trim();
                const text = b.textContent?.trim();
                return !aria && !labelledby && !text;
            }).length;
        });
        expect(namelessCount).toBe(0);
    });
});

test.describe('no horizontal overflow (M6.2)', () => {
    test('desktop 1280×800 — page content does not overflow horizontally', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /Ogni colonna/i })).toBeVisible();
        expect(await pageOverflow(page)).toBeLessThanOrEqual(2);
    });

    test('narrow desktop 1024 — no overflow', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /Ogni colonna/i })).toBeVisible();
        expect(await pageOverflow(page)).toBeLessThanOrEqual(2);
    });

    test('emulated 150% zoom (853×533) — no overflow', async ({ page }) => {
        // 1280/1.5 ≈ 853, 800/1.5 ≈ 533 emulates a 150% browser zoom.
        await page.setViewportSize({ width: 853, height: 533 });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /Ogni colonna/i })).toBeVisible();
        expect(await pageOverflow(page)).toBeLessThanOrEqual(2);
    });
});

test.describe('CSV export (M6.3)', () => {
    test('Export CSV triggers a download named tabular-<preset>.csv with a neutralised formula', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.locator('[data-testid="grid-mirror"]')).toBeAttached();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Export CSV/i }).click(),
        ]);

        expect(download.suggestedFilename()).toBe('tabular-returns.csv');

        // Read the file: every field is formula-neutralised, so any cell that
        // begins with =,+,-,@ would carry a leading single quote. The returns
        // preset has no such base data, so assert the structural invariant: no
        // raw line starts with an un-neutralised formula trigger.
        const path = await download.path();
        const fs = await import('node:fs/promises');
        const csv = await fs.readFile(path, 'utf8');
        const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);
        // RFC-4180-correct first-field extractor: a quoted field may contain
        // escaped quotes ("") and commas, so we can't just split on the first
        // quote/comma. This unwraps the first field's real content so a quoted
        // "=\u2026" can't hide an un-neutralised formula behind a leading quote.
        const firstField = (line: string): string => {
            if (!line.startsWith('"')) {
                const comma = line.indexOf(',');
                return comma >= 0 ? line.slice(0, comma) : line;
            }
            let out = '';
            for (let i = 1; i < line.length; i++) {
                if (line[i] === '"') {
                    if (line[i + 1] === '"') { out += '"'; i++; continue; }
                    break; // closing quote
                }
                out += line[i];
            }
            return out;
        };
        for (const line of lines) {
            // A neutralised field begins with ' (apostrophe), never =,+,-,@,tab,CR.
            expect(/^[=+\-@\t\r]/.test(firstField(line))).toBe(false);
        }
        // Header row present.
        expect(lines[0]).toMatch(/Reso|Cliente|Motivo|ID/i);
        // One row per entity (14 returns) + header.
        expect(lines.length).toBe(15);
    });
});
