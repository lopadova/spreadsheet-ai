import { describe, expect, it } from 'vitest';
import { GridCellKind } from '@glideapps/glide-data-grid';
import { agenticCellRenderer, cellSummaryText, type AgenticCellData } from '../../resources/js/grid/renderers';

function data(partial: Partial<AgenticCellData>): AgenticCellData {
    return {
        kind: 'agentic-cell',
        format: 'text',
        value: 'hi',
        flag: 'green',
        confidence: 0.9,
        citationIndex: null,
        citationCount: 0,
        ...partial,
    };
}

describe('agenticCellRenderer', () => {
    it('declares the Custom kind and matches our cell data', () => {
        expect(agenticCellRenderer.kind).toBe(GridCellKind.Custom);
        const matching = { data: data({}) } as never;
        const other = { data: { kind: 'other' } } as never;
        expect(agenticCellRenderer.isMatch(matching)).toBe(true);
        expect(agenticCellRenderer.isMatch(other)).toBe(false);
    });
});

describe('cellSummaryText — copyData + a11y mirror text', () => {
    it('renders rating as n/5', () => {
        expect(cellSummaryText(data({ format: 'rating', value: 4 }))).toBe('4/5');
        expect(cellSummaryText(data({ format: 'rating', value: '7' }))).toBe('5/5'); // clamped
    });
    it('renders percentage and json_path verbatim-ish', () => {
        expect(cellSummaryText(data({ format: 'percentage', value: '+18%' }))).toBe('+18%');
        expect(cellSummaryText(data({ format: 'json_path', value: 94 }))).toBe('94');
    });
    it('flattens arrays and person objects', () => {
        expect(cellSummaryText(data({ format: 'tags_multi', value: ['a', 'b'] }))).toBe('a · b');
        expect(cellSummaryText(data({ format: 'person', value: { name: 'Sara Conte', initials: 'SC' } }))).toBe(
            'Sara Conte',
        );
    });
});
