// ============================================================
// Bulk-selection helpers: translate a Glide GridSelection into the set of
// unique AI column_indexes it touches, so the bulk toolbar can call
// runColumns(uniqueSelectedColumnIndexes). Base (display) columns are ignored —
// only AI columns can be regenerated.
//
// Pure + dependency-light so it's unit-testable without a real GridSelection.
// ============================================================

import type { AiColumn } from '../api/client';

/** The slice of a Glide GridSelection we read. CompactSelection exposes toArray(). */
export interface GridSelectionLike {
    columns?: { toArray(): number[] };
    current?: {
        range: { x: number; width: number };
        rangeStack?: ReadonlyArray<{ x: number; width: number }>;
    };
}

/**
 * Compute the unique AI column_indexes selected, in ascending order.
 *
 * @param selection   the Glide grid selection
 * @param columns     the AI columns currently displayed (their `.index` is the
 *                    stable column_index used by the SSE endpoint)
 * @param baseCount   number of base (display) columns to the left of AI columns
 */
export function selectedAiColumnIndexes(
    selection: GridSelectionLike | undefined,
    columns: AiColumn[],
    baseCount: number,
): number[] {
    if (selection == null) return [];

    const gridCols = new Set<number>();

    // Whole-column selections.
    if (selection.columns) {
        for (const c of selection.columns.toArray()) gridCols.add(c);
    }

    // Cell-range selections (current + any additive ranges).
    const ranges: Array<{ x: number; width: number }> = [];
    if (selection.current) {
        ranges.push(selection.current.range);
        for (const r of selection.current.rangeStack ?? []) ranges.push(r);
    }
    for (const r of ranges) {
        for (let x = r.x; x < r.x + r.width; x++) gridCols.add(x);
    }

    // Map grid columns → AI column_index (only AI columns qualify).
    const out = new Set<number>();
    for (const gc of gridCols) {
        const aiPos = gc - baseCount;
        if (aiPos >= 0 && aiPos < columns.length) {
            out.add(columns[aiPos].index);
        }
    }
    return [...out].sort((a, b) => a - b);
}
