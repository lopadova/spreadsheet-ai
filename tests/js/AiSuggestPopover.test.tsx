import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiSuggestPopover } from '../../resources/js/components/AiSuggestPopover';
import type { Suggestion } from '../../resources/js/api/client';

const suggestions: Suggestion[] = [
    { name: 'Probabilità chargeback 30gg', format: 'percentage', prompt: 'Stima probabilità chargeback nei prossimi 30 giorni in %.' },
    { name: 'Lifetime value cliente', format: 'monetary_amount', prompt: 'LTV stimato del cliente in EUR.' },
    { name: 'Reso fraudolento?', format: 'yes_no', prompt: 'Pattern suggerisce reso fraudolento?' },
];

describe('AiSuggestPopover', () => {
    it('renders nothing when closed', () => {
        const { container } = render(
            <AiSuggestPopover open={false} suggestions={suggestions} onPick={() => {}} onClose={() => {}} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('lists suggestions with name + format · prompt preview', () => {
        render(<AiSuggestPopover open suggestions={suggestions} onPick={() => {}} onClose={() => {}} />);
        expect(screen.getByRole('menu', { name: /AI suggested columns/i })).toBeInTheDocument();
        expect(screen.getByText('Probabilità chargeback 30gg')).toBeInTheDocument();
        expect(screen.getByText(/percentage · Stima probabilità chargeback/)).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('calls onPick with the chosen suggestion', () => {
        const onPick = vi.fn();
        render(<AiSuggestPopover open suggestions={suggestions} onPick={onPick} onClose={() => {}} />);
        fireEvent.click(screen.getByText('Reso fraudolento?'));
        expect(onPick).toHaveBeenCalledWith(suggestions[2]);
    });

    it('shows an empty state when there are no suggestions', () => {
        render(<AiSuggestPopover open suggestions={[]} onPick={() => {}} onClose={() => {}} />);
        expect(screen.getByText(/Niente da suggerire/i)).toBeInTheDocument();
    });

    it('closes on veil click', () => {
        const onClose = vi.fn();
        const { container } = render(
            <AiSuggestPopover open suggestions={suggestions} onPick={() => {}} onClose={onClose} />,
        );
        fireEvent.click(container.querySelector('.popover-veil')!);
        expect(onClose).toHaveBeenCalled();
    });
});
