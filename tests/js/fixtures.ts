import type { AiColumn, Cell, ReviewResponse, Row } from '../../resources/js/api/client';

export const sampleRows: Row[] = [
    { row_id: 'R1', id: 'R1', customer: 'Maria' },
    { row_id: 'R2', id: 'R2', customer: 'Luca' },
    { row_id: 'R3', id: 'R3', customer: 'Giulia' },
];

export const sampleColumns: AiColumn[] = [
    { index: 0, name: 'Motivo', prompt: 'classify', format: 'enum', enum_values: ['A', 'B'] },
    { index: 1, name: 'Seriale?', prompt: 'yes/no', format: 'yes_no' },
    // json_path column → LLM-free → must be excluded from cost.
    { index: 2, name: 'Confidence', prompt: '$.a.b', format: 'percentage', json_path: '$.a.b' },
];

export const sampleReview: ReviewResponse = {
    review: { id: 1, preset_key: 'returns', title: 'Triage Resi', row_source: 'returns_rows' },
    base_columns: [
        { id: 'id', name: 'Reso' },
        { id: 'customer', name: 'Cliente' },
    ],
    columns: sampleColumns,
    rows: sampleRows,
    cells: [],
    suggestions_available: true,
};

export function makeCell(rowId: string, columnIndex: number, partial: Partial<Cell> = {}): Cell {
    return {
        row_id: rowId,
        column_index: columnIndex,
        content: { summary: 'ok', flag: 'green', reasoning: 'because', citations: ['fonte X'] },
        flag: 'green',
        confidence: 0.9,
        status: 'ready',
        ...partial,
    };
}
