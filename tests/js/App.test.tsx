import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../resources/js/AppRoot';
import { HeroBanner } from '../../resources/js/components/HeroBanner';
import { computeHeroStats } from '../../resources/js/lib/stats';
import { sampleColumns, sampleRows, sampleReview } from './fixtures';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('HeroBanner', () => {
    it('renders the title and computed stats', () => {
        const stats = computeHeroStats(sampleRows, sampleColumns);
        render(<HeroBanner stats={stats} />);
        expect(screen.getByRole('heading', { name: /Ogni colonna/i })).toBeInTheDocument();
        expect(screen.getByText('è un prompt.')).toBeInTheDocument();
        // 3 rows, 3 cols → 9 cells; cost over 2 LLM cols × 3 rows × 0.0008.
        expect(screen.getByText('9')).toBeInTheDocument();
        expect(screen.getByText('€0.0048')).toBeInTheDocument();
        expect(screen.getByText('1.8s')).toBeInTheDocument();
    });

    it('renders skeletons while loading', () => {
        const { container } = render(
            <HeroBanner stats={computeHeroStats([], [])} loading />,
        );
        expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    });
});

describe('App shell', () => {
    it('mounts the page chrome with a mocked review fetch', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input);
                const body = url.includes('/api/suggest/')
                    ? { preset: 'returns', suggestions: [] }
                    : sampleReview;
                return new Response(JSON.stringify(body), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );
        render(<App />);
        expect(screen.getByRole('heading', { name: /Ogni colonna/i })).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(5);
        expect(screen.getByRole('button', { name: /Run all/i })).toBeInTheDocument();
    });
});
