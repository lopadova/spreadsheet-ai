import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionBar, type RunProgress } from '../../resources/js/components/ActionBar';
import type { Suggestion } from '../../resources/js/api/client';

const noop = () => {};

function renderBar(overrides: Partial<Parameters<typeof ActionBar>[0]> = {}) {
    const props = {
        onAddColumn: noop,
        onExport: noop,
        onShare: noop,
        onRun: noop,
        onStop: noop,
        onPickSuggestion: noop,
        running: false,
        progress: { done: 0, total: 0 } as RunProgress,
        liveMode: false,
        onToggleLiveMode: noop,
        suggestions: [] as Suggestion[],
        ...overrides,
    };
    render(<ActionBar {...props} />);
    return props;
}

describe('ActionBar (idle)', () => {
    it('renders all idle-state buttons', () => {
        renderBar();
        expect(screen.getByRole('button', { name: /AI Suggest/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add column/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Share/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Run all/i })).toBeInTheDocument();
    });

    it('defaults the LLM toggle to Mock mode · no API calls', () => {
        renderBar();
        const toggle = screen.getByRole('button', { name: /Mock mode/i });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('no API calls')).toBeInTheDocument();
    });

    it('fires callbacks for export/share/run/add', () => {
        const onExport = vi.fn();
        const onRun = vi.fn();
        const onAddColumn = vi.fn();
        renderBar({ onExport, onRun, onAddColumn });
        fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
        fireEvent.click(screen.getByRole('button', { name: /Run all/i }));
        fireEvent.click(screen.getByRole('button', { name: /Add column/i }));
        expect(onExport).toHaveBeenCalled();
        expect(onRun).toHaveBeenCalled();
        expect(onAddColumn).toHaveBeenCalled();
    });
});

describe('ActionBar (running)', () => {
    it('shows a progress bar with done/total and a Stop button', () => {
        renderBar({ running: true, progress: { done: 4, total: 10 } });
        expect(screen.getByText(/Generating · 4\/10/)).toBeInTheDocument();
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '40');
        expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Run all/i })).not.toBeInTheDocument();
    });
});

describe('ActionBar AI Suggest popover', () => {
    it('opens and lists suggestions, calling onPickSuggestion', () => {
        const onPickSuggestion = vi.fn();
        const suggestions: Suggestion[] = [
            { name: 'Probabilità chargeback', format: 'percentage', prompt: 'p' },
            { name: 'LTV cliente', format: 'monetary_amount', prompt: 'p' },
        ];
        renderBar({ suggestions, onPickSuggestion });
        fireEvent.click(screen.getByRole('button', { name: /AI Suggest/i }));
        const menu = screen.getByRole('menu', { name: /AI suggested columns/i });
        expect(menu).toBeInTheDocument();
        expect(screen.getByText('Probabilità chargeback')).toBeInTheDocument();
        fireEvent.click(screen.getByText('LTV cliente'));
        expect(onPickSuggestion).toHaveBeenCalledWith(suggestions[1]);
    });
});
