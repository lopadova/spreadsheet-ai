// ============================================================
// Tabular Review — cell store
// Single source of truth for AI cell values, keyed "${row_id}:${column_index}".
// M4 feeds live SSE `cell` events through `set` / `bulkLoad`.
// ============================================================

import { useRef, useSyncExternalStore } from 'react';
import type { Cell } from '../api/client';

export type CellKey = string;

export function cellKey(rowId: string, columnIndex: number): CellKey {
    return `${rowId}:${columnIndex}`;
}

export interface CellStore {
    /** Replace the entire store with the given cells (e.g. on review load). */
    bulkLoad(cells: Cell[]): void;
    /** Upsert a single cell. */
    set(cell: Cell): void;
    /** Read a single cell, or undefined if not present. */
    get(rowId: string, columnIndex: number): Cell | undefined;
    /** Read by raw key. */
    getByKey(key: CellKey): Cell | undefined;
    /** Number of stored cells. */
    size(): number;
    /** All stored cells (insertion order). */
    all(): Cell[];
    /** Remove every stored cell. */
    clear(): void;
}

export interface SubscribableCellStore extends CellStore {
    subscribe(fn: () => void): () => void;
    snapshot(): ReadonlyMap<CellKey, Cell>;
}

/**
 * A plain (non-React) cell store. Used directly in tests and as the backing
 * data for the {@link useCellStore} hook. Mutations swap the internal Map
 * reference so `useSyncExternalStore` snapshots compare unequal and re-render.
 */
export function createCellStore(): SubscribableCellStore {
    let map: Map<CellKey, Cell> = new Map();
    const listeners = new Set<() => void>();

    const emit = () => {
        for (const fn of listeners) fn();
    };

    return {
        bulkLoad(cells: Cell[]) {
            map = new Map();
            for (const cell of cells) {
                map.set(cellKey(cell.row_id, cell.column_index), cell);
            }
            emit();
        },
        set(cell: Cell) {
            map = new Map(map);
            map.set(cellKey(cell.row_id, cell.column_index), cell);
            emit();
        },
        get(rowId: string, columnIndex: number) {
            return map.get(cellKey(rowId, columnIndex));
        },
        getByKey(key: CellKey) {
            return map.get(key);
        },
        size() {
            return map.size;
        },
        all() {
            return [...map.values()];
        },
        clear() {
            map = new Map();
            emit();
        },
        subscribe(fn: () => void) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        snapshot() {
            return map;
        },
    };
}

/**
 * React hook returning a stable per-component cell store that re-renders the
 * caller whenever cells change. Pass an external store to share state across
 * components (e.g. the one seeded by {@link useReview}).
 */
export function useCellStore(external?: SubscribableCellStore): {
    store: SubscribableCellStore;
    cells: ReadonlyMap<CellKey, Cell>;
} {
    const ref = useRef<SubscribableCellStore | null>(null);
    const store = external ?? (ref.current ??= createCellStore());

    const cells = useSyncExternalStore(
        store.subscribe,
        store.snapshot,
        store.snapshot,
    );

    return { store, cells };
}
