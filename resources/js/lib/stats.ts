import type { AiColumn, Row } from '../api/client';

/** Per-LLM-cell demo cost in EUR (json_path columns are LLM-free → excluded). */
export const COST_PER_LLM_CELL = 0.0008;

export interface HeroStats {
    rows: number;
    aiColumns: number;
    cells: number;
    /** EUR cost; only LLM columns count (json_path columns are free). */
    cost: number;
    /** Fixed demo p95 latency (seconds). */
    latency: number;
}

/** True for columns resolved by json_path (no LLM call, no cost). */
export function isJsonPathColumn(col: AiColumn): boolean {
    return col.format === 'json_path' || (col.json_path != null && col.json_path !== '');
}

export function computeHeroStats(rows: Row[], columns: AiColumn[]): HeroStats {
    const rowCount = rows.length;
    const aiColumns = columns.length;
    const cells = rowCount * aiColumns;
    const llmColumns = columns.filter((c) => !isJsonPathColumn(c)).length;
    const cost = llmColumns * rowCount * COST_PER_LLM_CELL;
    return { rows: rowCount, aiColumns, cells, cost, latency: 1.8 };
}
