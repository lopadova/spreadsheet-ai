import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CellSidePanel,
    copyToClipboard,
    type CellSelection,
} from '../../resources/js/components/CellSidePanel';
import { makeCell } from './fixtures';
import type { AiColumn } from '../../resources/js/api/client';

const selection: CellSelection = { rowId: 'R1', columnIndex: 1 };
const column: AiColumn = { index: 1, name: 'Seriale?', prompt: 'Il cliente ha più di 3 resi?', format: 'yes_no' };

function renderPanel(overrides: Partial<Parameters<typeof CellSidePanel>[0]> = {}) {
    const onRegenerate = vi.fn();
    const onClose = vi.fn();
    render(
        <CellSidePanel
            open
            selection={selection}
            cell={makeCell('R1', 1, {
                content: { summary: 'Yes', flag: 'yellow', reasoning: 'Pattern ricorrente', citations: ['ordine RET-1', 'ordine RET-2'] },
                flag: 'yellow',
                confidence: 0.65,
            })}
            column={column}
            onRegenerate={onRegenerate}
            onClose={onClose}
            {...overrides}
        />,
    );
    return { onRegenerate, onClose };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CellSidePanel', () => {
    it('renders nothing when closed or no selection', () => {
        const { container } = render(
            <CellSidePanel open={false} selection={null} cell={undefined} column={undefined} onClose={() => {}} onRegenerate={() => {}} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders value, flag/confidence, reasoning and citations', () => {
        renderPanel();
        expect(screen.getByTestId('cp-value')).toHaveTextContent('Yes');
        expect(screen.getByTestId('cp-flag')).toHaveAttribute('data-flag', 'yellow');
        expect(screen.getByTestId('cp-flag')).toHaveTextContent('65%');
        expect(screen.getByTestId('cp-reasoning')).toHaveTextContent('Pattern ricorrente');
        const cits = screen.getByTestId('cp-citations');
        expect(cits).toHaveTextContent('ordine RET-1');
        expect(cits).toHaveTextContent('ordine RET-2');
    });

    it('shows the prompt only after expanding it', () => {
        renderPanel();
        expect(screen.queryByTestId('cp-prompt')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Prompt/i }));
        expect(screen.getByTestId('cp-prompt')).toHaveTextContent('Il cliente ha più di 3 resi?');
    });

    it('Regenerate calls back with the column index', () => {
        const { onRegenerate } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: /Regenerate/i }));
        expect(onRegenerate).toHaveBeenCalledWith(1);
    });

    it('Copy value writes the value to the clipboard when available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: /Copy value/i }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Yes'));
    });
});

describe('copyToClipboard guard', () => {
    it('returns false when navigator.clipboard is missing (no throw)', async () => {
        vi.stubGlobal('navigator', {});
        await expect(copyToClipboard('x')).resolves.toBe(false);
    });
    it('returns true when clipboard.writeText resolves', async () => {
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        await expect(copyToClipboard('x')).resolves.toBe(true);
    });
});
