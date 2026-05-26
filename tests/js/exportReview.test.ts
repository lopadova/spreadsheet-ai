import { describe, expect, it } from 'vitest';
import { aiCellText, buildReviewMatrix } from '../../resources/js/lib/exportReview';
import { createCellStore } from '../../resources/js/store/cells';
import type { AiColumn, BaseColumn, Cell, Row } from '../../resources/js/api/client';

function readyCell(rowId: string, columnIndex: number, summary: unknown, flag = 'green'): Cell {
    return {
        row_id: rowId,
        column_index: columnIndex,
        content: { summary: summary as string | null, flag, reasoning: null, citations: null },
        flag,
        confidence: 0.9,
        status: 'ready',
    };
}

const enumCol: AiColumn = { index: 0, name: 'Motivo', prompt: 'p', format: 'enum' };
const ratingCol: AiColumn = { index: 1, name: 'Rischio', prompt: 'p', format: 'rating' };

describe('aiCellText', () => {
    it('returns empty string for a missing / generating / pending cell', () => {
        expect(aiCellText(undefined, enumCol)).toBe('');
        expect(aiCellText({ ...readyCell('r', 0, 'x'), status: 'generating' }, enumCol)).toBe('');
        expect(aiCellText({ ...readyCell('r', 0, 'x'), status: 'pending' }, enumCol)).toBe('');
    });

    it('returns an em-dash for a ready cell with a null summary (refusal)', () => {
        expect(aiCellText(readyCell('r', 0, null), enumCol)).toBe('—');
    });

    it('renders the rating format as n/5 clamped 0..5', () => {
        expect(aiCellText(readyCell('r', 1, 3), ratingCol)).toBe('3/5');
        expect(aiCellText(readyCell('r', 1, 9), ratingCol)).toBe('5/5');
        expect(aiCellText(readyCell('r', 1, 'nope'), ratingCol)).toBe('—');
    });

    it('renders arrays joined and plain strings as-is', () => {
        expect(aiCellText(readyCell('r', 0, ['a', 'b']), enumCol)).toBe('a · b');
        expect(aiCellText(readyCell('r', 0, 'Wrong Size'), enumCol)).toBe('Wrong Size');
    });
});

describe('buildReviewMatrix', () => {
    const baseColumns: BaseColumn[] = [
        { id: 'rid', name: 'ID' },
        { id: 'customer', name: 'Cliente' },
    ];
    const aiColumns: AiColumn[] = [enumCol, ratingCol];
    const rows: Row[] = [
        { row_id: 'RET-1', rid: 'RET-1', customer: 'Mario' },
        { row_id: 'RET-2', rid: 'RET-2', customer: 'Lucia' },
    ];

    it('maps review + cells to the right header/row matrix', () => {
        const store = createCellStore();
        store.bulkLoad([
            readyCell('RET-1', 0, 'Wrong Size'),
            readyCell('RET-1', 1, 4),
            readyCell('RET-2', 0, 'Defective'),
            // RET-2 rating cell intentionally missing → empty.
        ]);

        const { headers, rows: body } = buildReviewMatrix(baseColumns, aiColumns, rows, store);

        expect(headers).toEqual(['ID', 'Cliente', 'Motivo', 'Rischio']);
        expect(body).toEqual([
            ['RET-1', 'Mario', 'Wrong Size', '4/5'],
            ['RET-2', 'Lucia', 'Defective', ''],
        ]);
    });
});
