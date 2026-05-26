import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { DataEditorRef } from '@glideapps/glide-data-grid';
import { AgenticGrid } from '../../resources/js/grid/AgenticGrid';
import { createCellStore } from '../../resources/js/store/cells';
import { sampleColumns, sampleRows, makeCell } from './fixtures';

const baseColumns = [
    { id: 'id', name: 'Reso' },
    { id: 'customer', name: 'Cliente' },
];

describe('AgenticGrid — offscreen a11y mirror reflects the cell store', () => {
    it('renders base column values and empty AI cells before generation', () => {
        const store = createCellStore();
        const gridRef = createRef<DataEditorRef>();
        render(
            <AgenticGrid
                preset="returns"
                baseColumns={baseColumns}
                columns={sampleColumns}
                rows={sampleRows}
                store={store}
                gridRef={gridRef}
            />,
        );
        // Mirror exists and reflects base data.
        const mirror = screen.getByTestId('grid-mirror');
        expect(mirror).toBeInTheDocument();
        const cell = screen.getByTestId('cell-R1-0');
        expect(cell).toHaveAttribute('data-status', 'empty');
        expect(cell.textContent).toBe('');
    });

    it('shows AI cell values once the store has ready cells', () => {
        const store = createCellStore();
        store.set(makeCell('R1', 0, { content: { summary: 'Wrong Size', flag: 'green', reasoning: '', citations: [] } }));
        store.set(makeCell('R2', 1, { content: { summary: 'No', flag: 'green', reasoning: '', citations: [] } }));
        const gridRef = createRef<DataEditorRef>();
        render(
            <AgenticGrid
                preset="returns"
                baseColumns={baseColumns}
                columns={sampleColumns}
                rows={sampleRows}
                store={store}
                gridRef={gridRef}
            />,
        );
        expect(screen.getByTestId('cell-R1-0').textContent).toBe('Wrong Size');
        expect(screen.getByTestId('cell-R1-0')).toHaveAttribute('data-status', 'ready');
        expect(screen.getByTestId('cell-R2-1').textContent).toBe('No');
        // Filled-count caption.
        expect(screen.getByTestId('mirror-filled-count').textContent).toBe('2');
    });

    it('hides values while a cell is generating (skeleton in canvas)', () => {
        const store = createCellStore();
        store.set({
            row_id: 'R1',
            column_index: 0,
            content: null,
            flag: null,
            confidence: null,
            status: 'generating',
        });
        const gridRef = createRef<DataEditorRef>();
        render(
            <AgenticGrid
                preset="returns"
                baseColumns={baseColumns}
                columns={sampleColumns}
                rows={sampleRows}
                store={store}
                gridRef={gridRef}
            />,
        );
        const cell = screen.getByTestId('cell-R1-0');
        expect(cell).toHaveAttribute('data-status', 'generating');
        expect(cell.textContent).toBe('');
    });
});
