// ============================================================
// Tabular Review — CSV export builder (pure + unit-tested).
//
// Maps the loaded review (base columns + AI columns + rows) plus the cell store
// into a header row + a body matrix suitable for `toCsv`. One CSV row per
// entity. Each AI cell's value uses the shared `cellDisplayText` helper (the
// single source of truth also used by the grid mirror), so export text always
// matches the grid (rating "n/5", "—" for null, empty for generating/pending).
// ============================================================

import type { AiColumn, BaseColumn, Cell, Row } from '../api/client';
import { cellDisplayText } from '../grid/format';

/** Read-only view of a cell store keyed by `${rowId}:${columnIndex}`. */
export interface CellLookup {
    get(rowId: string, columnIndex: number): Cell | undefined;
}

/** Render an AI cell to its export text — shares `cellDisplayText` with the grid mirror. */
export function aiCellText(cell: Cell | undefined, column: AiColumn): string {
    return cellDisplayText(cell, column.format);
}

export interface ReviewMatrix {
    headers: string[];
    rows: string[][];
}

/**
 * Build the header row + body matrix for the current review. Columns are the
 * base columns followed by the AI columns, in order.
 */
export function buildReviewMatrix(
    baseColumns: BaseColumn[],
    aiColumns: AiColumn[],
    rows: Row[],
    cells: CellLookup,
): ReviewMatrix {
    const headers = [
        ...baseColumns.map((c) => c.name),
        ...aiColumns.map((c) => c.name),
    ];
    const body = rows.map((row) => [
        ...baseColumns.map((c) => String(row[c.id] ?? '')),
        ...aiColumns.map((c) => aiCellText(cells.get(row.row_id, c.index), c)),
    ]);
    return { headers, rows: body };
}
