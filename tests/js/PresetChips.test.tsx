import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PresetChips } from '../../resources/js/components/PresetChips';

describe('PresetChips', () => {
    it('renders all 5 preset chips', () => {
        render(<PresetChips active="returns" onPick={() => {}} />);
        const chips = screen.getAllByRole('tab');
        expect(chips).toHaveLength(5);
        expect(screen.getByText('Triage Resi')).toBeInTheDocument();
        expect(screen.getByText('Tutti i 16 formati')).toBeInTheDocument();
    });

    it('marks the active chip as selected', () => {
        render(<PresetChips active="fraud" onPick={() => {}} />);
        const active = screen.getByRole('tab', { selected: true });
        expect(active).toHaveTextContent('Frode Ordini');
    });

    it('calls onPick with the chip id when clicked', () => {
        const onPick = vi.fn();
        render(<PresetChips active="returns" onPick={onPick} />);
        fireEvent.click(screen.getByText('Audit Schede'));
        expect(onPick).toHaveBeenCalledWith('articles');
    });
});
