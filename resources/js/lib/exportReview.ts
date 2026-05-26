// ============================================================
// Tabular Review — CSV export builder (pure + unit-tested).
//
// Maps the loaded review (base columns + AI columns + rows) plus the cell store
// into a header row + a body matrix suitable for `toCsv`. One CSV row per
// entity. Each AI cell's value is the rendered text of `content.summary` via
// `valueToText`, matching what the grid mirror shows (incl. the rating "n/5"
// special-case). Generating / pending / missing cells export as empty.
// ============================================================

import type { AiColumn, BaseColumn, Cell, Row } from '../api/client';
import { valueToText } from '../grid/format';

/** Read-only view of a cell store keyed by `${rowId}:${columnIndex}`. */
export interface CellLookup {
    get(rowId: string, columnIndex: number): Cell | undefined;
}

/** Render an AI cell to its export text (mirrors AgenticGrid's mirrorCellText). */
export function aiCellText(cell: Cell | undefined, column: AiColumn): string {
    if (cell == null) return '';
    if (cell.status === 'generating' || cell.status === 'pending') return '';
    const value = cell.content?.summary ?? null;
    if (value == null) return '—';
    if (column.format === 'rating') {
        const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        return Number.isFinite(n) ? `${Math.max(0, Math.min(5, n))}/5` : '—';
    }
    return valueToText(value);
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
