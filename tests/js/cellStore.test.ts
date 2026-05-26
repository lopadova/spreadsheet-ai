import { describe, expect, it } from 'vitest';
import { cellKey, createCellStore } from '../../resources/js/store/cells';
import { makeCell } from './fixtures';

describe('cell store', () => {
    it('builds keys as "${row_id}:${column_index}"', () => {
        expect(cellKey('RET-1042', 3)).toBe('RET-1042:3');
    });

    it('set then get round-trips a cell', () => {
        const store = createCellStore();
        const cell = makeCell('R1', 0);
        store.set(cell);
        expect(store.get('R1', 0)).toEqual(cell);
        expect(store.getByKey('R1:0')).toEqual(cell);
        expect(store.size()).toBe(1);
    });

    it('returns undefined for a missing cell', () => {
        const store = createCellStore();
        expect(store.get('nope', 9)).toBeUndefined();
    });

    it('bulkLoad replaces all cells and re-keys correctly', () => {
        const store = createCellStore();
        store.set(makeCell('OLD', 0));
        store.bulkLoad([makeCell('R1', 0), makeCell('R1', 1), makeCell('R2', 0)]);
        expect(store.size()).toBe(3);
        expect(store.get('OLD', 0)).toBeUndefined();
        expect(store.get('R1', 1)?.row_id).toBe('R1');
    });

    it('set upserts (same key overwrites)', () => {
        const store = createCellStore();
        store.set(makeCell('R1', 0, { flag: 'green' }));
        store.set(makeCell('R1', 0, { flag: 'red' }));
        expect(store.size()).toBe(1);
        expect(store.get('R1', 0)?.flag).toBe('red');
    });

    it('notifies subscribers on mutation', () => {
        const store = createCellStore();
        let calls = 0;
        const unsub = store.subscribe(() => calls++);
        store.set(makeCell('R1', 0));
        store.bulkLoad([makeCell('R2', 0)]);
        store.clear();
        unsub();
        store.set(makeCell('R3', 0));
        expect(calls).toBe(3);
    });
});
