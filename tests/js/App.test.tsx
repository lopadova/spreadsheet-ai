import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../resources/js/AppRoot';

describe('App placeholder', () => {
    it('renders the foundation hero', () => {
        render(<App />);
        expect(
            screen.getByRole('heading', { name: /Tabular Review — foundation ready/i }),
        ).toBeInTheDocument();
    });
});
