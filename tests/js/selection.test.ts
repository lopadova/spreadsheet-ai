import { describe, expect, it } from 'vitest';
import { selectedAiColumnIndexes, type GridSelectionLike } from '../../resources/js/grid/selection';
import { sampleColumns } from './fixtures';

// 2 base columns precede the 3 AI columns (indexes 0,1,2).
const BASE = 2;

function cols(arr: number[]): GridSelectionLike['columns'] {
    return { toArray: () => arr };
}

describe('selectedAiColumnIndexes', () => {
    it('returns [] for an empty/undefined selection', () => {
        expect(selectedAiColumnIndexes(undefined, sampleColumns, BASE)).toEqual([]);
        expect(selectedAiColumnIndexes({}, sampleColumns, BASE)).toEqual([]);
    });

    it('maps whole-column grid selections to AI column_index, ignoring base columns', () => {
        // Grid cols 0,1 are base; 2,3,4 are AI columns mapping to index 0,1,2.
        const sel: GridSelectionLike = { columns: cols([0, 2, 4]) };
        expect(selectedAiColumnIndexes(sel, sampleColumns, BASE)).toEqual([0, 2]);
    });

    it('maps a cell range to the AI columns it spans', () => {
        const sel: GridSelectionLike = { current: { range: { x: 3, width: 2 } } };
        // grid cols 3,4 → AI index 1,2
        expect(selectedAiColumnIndexes(sel, sampleColumns, BASE)).toEqual([1, 2]);
    });

    it('dedupes across column-selection, current range, and rangeStack and sorts ascending', () => {
        const sel: GridSelectionLike = {
            columns: cols([4]),
            current: {
                range: { x: 2, width: 1 },
                rangeStack: [{ x: 3, width: 1 }],
            },
        };
        // grid 4→2, 2→0, 3→1  ⇒ unique sorted [0,1,2]
        expect(selectedAiColumnIndexes(sel, sampleColumns, BASE)).toEqual([0, 1, 2]);
    });

    it('ignores selections entirely within base columns', () => {
        const sel: GridSelectionLike = { current: { range: { x: 0, width: 2 } } };
        expect(selectedAiColumnIndexes(sel, sampleColumns, BASE)).toEqual([]);
    });
});
