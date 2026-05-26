import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    ColumnEditor,
    buildColumnPayload,
} from '../../resources/js/components/ColumnEditor';
import { autoGeneratePrompt } from '../../resources/js/lib/formats';
import type { AiColumn } from '../../resources/js/api/client';

function renderEditor(overrides: Partial<Parameters<typeof ColumnEditor>[0]> = {}) {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const props = {
        open: true,
        mode: 'new' as const,
        column: null,
        onSubmit,
        onClose,
        onDelete,
        ...overrides,
    };
    render(<ColumnEditor {...props} />);
    return { onSubmit, onClose, onDelete };
}

describe('autoGeneratePrompt', () => {
    it('produces a distinct per-format prompt referencing the label', () => {
        expect(autoGeneratePrompt('yes_no', 'Seriale')).toContain('Yes/No');
        expect(autoGeneratePrompt('yes_no', 'Seriale')).toContain('Seriale');
        expect(autoGeneratePrompt('percentage', 'X')).toContain('percentuale');
        // json_path yields a JSON Path expression, not prose.
        expect(autoGeneratePrompt('json_path', 'My Field')).toBe('$.metadata.my_field');
    });
    it('falls back to a placeholder field when label is empty', () => {
        expect(autoGeneratePrompt('text', '')).toContain('questo campo');
    });
});

describe('buildColumnPayload', () => {
    it('builds a new-column payload (text)', () => {
        expect(
            buildColumnPayload({ name: ' Risk ', format: 'text', prompt: ' do it ', enumValues: '' }),
        ).toEqual({ name: 'Risk', format: 'text', prompt: 'do it' });
    });
    it('includes enum_values only for enum format', () => {
        const p = buildColumnPayload({ name: 'Sev', format: 'enum', prompt: 'p', enumValues: 'Low, High ,  ' });
        expect(p.enum_values).toEqual(['Low', 'High']);
    });
    it('maps prompt → json_path for json_path format', () => {
        const p = buildColumnPayload({ name: 'JP', format: 'json_path', prompt: '$.a.b', enumValues: '' });
        expect(p.json_path).toBe('$.a.b');
    });
});

describe('ColumnEditor interactions', () => {
    it('reveals the enum-values input only when format=enum', () => {
        renderEditor();
        expect(screen.queryByLabelText(/Enum values/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Enum/i }));
        expect(screen.getByLabelText(/Enum values/i)).toBeInTheDocument();
    });

    it('swaps Prompt → JSON Path, hides Auto-generate, and shows free cost when format=json_path', () => {
        renderEditor();
        expect(screen.getByRole('button', { name: /Auto-generate/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /JSON Path/i }));
        expect(screen.getByLabelText('JSON Path')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Auto-generate/i })).not.toBeInTheDocument();
        expect(screen.getByText('€0.00 (free)')).toBeInTheDocument();
        expect(screen.getByText('0 token')).toBeInTheDocument();
    });

    it('Auto-generate fills the prompt with a per-format sample', () => {
        vi.useFakeTimers();
        renderEditor();
        const label = screen.getByLabelText('Label');
        fireEvent.change(label, { target: { value: 'Margine' } });
        fireEvent.click(screen.getByRole('button', { name: /Auto-generate/i }));
        act(() => {
            vi.advanceTimersByTime(200);
        });
        const prompt = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
        expect(prompt.value).toContain('Margine');
        vi.useRealTimers();
    });

    it('Save emits the new-column payload (mode=new, no index)', () => {
        const { onSubmit } = renderEditor();
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Risk frode' } });
        fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Valuta il rischio' } });
        fireEvent.click(screen.getByRole('button', { name: /Save & regenerate/i }));
        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Risk frode', format: 'text', prompt: 'Valuta il rischio' },
            'new',
            undefined,
        );
    });

    it('Save emits the edit payload with the column index (mode=edit)', () => {
        const column: AiColumn = { index: 4, name: 'Seriale?', prompt: 'old', format: 'yes_no' };
        const { onSubmit } = renderEditor({ mode: 'edit', column });
        fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'nuovo prompt' } });
        fireEvent.click(screen.getByRole('button', { name: /Save & regenerate/i }));
        expect(onSubmit).toHaveBeenCalledWith(
            { name: 'Seriale?', format: 'yes_no', prompt: 'nuovo prompt' },
            'edit',
            4,
        );
    });

    it('prefills from the edited column', () => {
        const column: AiColumn = { index: 2, name: 'Motivo', prompt: 'classifica', format: 'enum', enum_values: ['A', 'B'] };
        renderEditor({ mode: 'edit', column });
        expect((screen.getByLabelText('Label') as HTMLInputElement).value).toBe('Motivo');
        expect((screen.getByLabelText(/Enum values/i) as HTMLInputElement).value).toBe('A, B');
    });

    it('Delete (edit mode) confirms then calls onDelete', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const column: AiColumn = { index: 3, name: 'X', prompt: 'p', format: 'text' };
        const { onDelete } = renderEditor({ mode: 'edit', column });
        fireEvent.click(screen.getByRole('button', { name: /Delete column/i }));
        expect(confirmSpy).toHaveBeenCalled();
        expect(onDelete).toHaveBeenCalledWith(3);
        confirmSpy.mockRestore();
    });

    it('does not render Delete in new mode', () => {
        renderEditor();
        expect(screen.queryByRole('button', { name: /Delete column/i })).not.toBeInTheDocument();
    });
});
