import { describe, expect, it } from 'vitest';
import { computeHeroStats, COST_PER_LLM_CELL, isJsonPathColumn } from '../../resources/js/lib/stats';
import { sampleColumns, sampleRows } from './fixtures';

describe('computeHeroStats', () => {
    it('computes rows × columns for total cells', () => {
        const stats = computeHeroStats(sampleRows, sampleColumns);
        expect(stats.rows).toBe(3);
        expect(stats.aiColumns).toBe(3);
        expect(stats.cells).toBe(9);
    });

    it('excludes json_path columns from cost', () => {
        // 3 rows, 3 cols of which 1 is json_path → only 2 LLM cols × 3 rows bill.
        const stats = computeHeroStats(sampleRows, sampleColumns);
        expect(stats.cost).toBeCloseTo(2 * 3 * COST_PER_LLM_CELL, 10);
    });

    it('returns fixed p95 latency', () => {
        expect(computeHeroStats(sampleRows, sampleColumns).latency).toBe(1.8);
    });

    it('handles empty input without NaN', () => {
        const stats = computeHeroStats([], []);
        expect(stats).toEqual({ rows: 0, aiColumns: 0, cells: 0, cost: 0, latency: 1.8 });
    });

    it('detects json_path columns by format or json_path field', () => {
        expect(isJsonPathColumn({ index: 0, name: 'x', prompt: '', format: 'json_path' })).toBe(true);
        expect(
            isJsonPathColumn({ index: 0, name: 'x', prompt: '', format: 'percentage', json_path: '$.a' }),
        ).toBe(true);
        expect(isJsonPathColumn({ index: 0, name: 'x', prompt: '', format: 'text' })).toBe(false);
    });
});
