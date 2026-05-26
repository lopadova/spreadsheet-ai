import { describe, expect, it } from 'vitest';
import { createCellStore } from '../../resources/js/store/cells';
import {
    applyCellEvent,
    eventToCell,
    progressPercent,
    type SseCellEvent,
} from '../../resources/js/grid/sseReducer';

function ev(rowId: string, colIndex: number, summary: string): SseCellEvent {
    return {
        row_id: rowId,
        column_index: colIndex,
        content: { summary, flag: 'green', reasoning: '', citations: [] },
        flag: 'green',
        confidence: 0.9,
        status: 'ready',
    };
}

describe('applyCellEvent — store write + run-token guard (§1.A.7, §1.A.8)', () => {
    it('writes the cell at the right key when the token matches', () => {
        const store = createCellStore();
        const key = applyCellEvent({ store, ev: ev('R1', 2, 'hi'), eventToken: 5, activeToken: 5 });
        expect(key).toBe('R1:2');
        expect(store.get('R1', 2)?.content?.summary).toBe('hi');
        expect(store.size()).toBe(1);
    });

    it('IGNORES events from a stale run token (no store write)', () => {
        const store = createCellStore();
        // Event tagged with the OLD token while the active run moved on.
        const key = applyCellEvent({ store, ev: ev('R1', 0, 'stale'), eventToken: 1, activeToken: 2 });
        expect(key).toBeNull();
        expect(store.size()).toBe(0);
        expect(store.get('R1', 0)).toBeUndefined();
    });

    it('eventToCell maps the payload to the Cell shape', () => {
        const cell = eventToCell(ev('R3', 1, 'x'));
        expect(cell).toMatchObject({ row_id: 'R3', column_index: 1, status: 'ready', flag: 'green' });
    });
});

describe('progressPercent', () => {
    it('computes a clamped 0..100 value', () => {
        expect(progressPercent({ done: 0, total: 0 })).toBe(0);
        expect(progressPercent({ done: 5, total: 10 })).toBe(50);
        expect(progressPercent({ done: 10, total: 10 })).toBe(100);
        expect(progressPercent({ done: 99, total: 10 })).toBe(100);
    });
});
