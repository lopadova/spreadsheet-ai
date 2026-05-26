import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addColumn,
    deleteColumn,
    getReview,
    getSuggestions,
    streamUrl,
    updateColumn,
} from '../../resources/js/api/client';

type FetchArgs = [string, RequestInit];

function mockFetch(body: unknown = {}, status = 200) {
    const fn = vi.fn(
        async (..._args: FetchArgs) =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'Content-Type': 'application/json' },
            }),
    );
    vi.stubGlobal('fetch', fn);
    return fn;
}

beforeEach(() => {
    // Set a CSRF cookie for mutation tests.
    Object.defineProperty(document, 'cookie', {
        writable: true,
        configurable: true,
        value: 'XSRF-TOKEN=tok%2Fen123; other=x',
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('api client URLs', () => {
    it('getReview builds the review URL', async () => {
        const fetchFn = mockFetch({ review: {} });
        await getReview('returns');
        expect(fetchFn).toHaveBeenCalledWith('/api/reviews/returns', expect.anything());
    });

    it('getSuggestions builds the suggest URL', async () => {
        const fetchFn = mockFetch({ preset: 'returns', suggestions: [] });
        await getSuggestions('fraud');
        expect(fetchFn).toHaveBeenCalledWith('/api/suggest/fraud', expect.anything());
    });

    it('streamUrl encodes cols and force', () => {
        expect(streamUrl(7)).toBe('/api/reviews/7/stream');
        expect(streamUrl(7, { cols: [1, 3] })).toBe('/api/reviews/7/stream?cols=1%2C3');
        expect(streamUrl(7, { cols: [2], force: true })).toBe('/api/reviews/7/stream?cols=2&force=1');
        expect(streamUrl(7, { force: true })).toBe('/api/reviews/7/stream?force=1');
    });
});

describe('api client CSRF + headers', () => {
    it('GET requests do NOT carry X-XSRF-TOKEN', async () => {
        const fetchFn = mockFetch({});
        await getReview('returns');
        const headers = new Headers(fetchFn.mock.calls[0][1].headers);
        expect(headers.get('X-XSRF-TOKEN')).toBeNull();
        expect(headers.get('Accept')).toBe('application/json');
    });

    it('POST addColumn sets X-XSRF-TOKEN from the decoded cookie', async () => {
        const fetchFn = mockFetch({ index: 3 });
        await addColumn(5, { name: 'c', prompt: 'p', format: 'text' });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('/api/reviews/5/columns');
        expect(init.method).toBe('POST');
        const headers = new Headers(init.headers);
        expect(headers.get('X-XSRF-TOKEN')).toBe('tok/en123');
        expect(headers.get('Content-Type')).toBe('application/json');
        expect(init.credentials).toBe('same-origin');
        expect(init.body).toBe(JSON.stringify({ name: 'c', prompt: 'p', format: 'text' }));
    });

    it('PATCH updateColumn targets the indexed column with CSRF', async () => {
        const fetchFn = mockFetch({ index: 1 });
        await updateColumn(5, 1, { prompt: 'new' });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('/api/reviews/5/columns/1');
        expect(init.method).toBe('PATCH');
        expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('tok/en123');
    });

    it('DELETE deleteColumn carries CSRF and parses 204', async () => {
        const fetchFn = vi.fn(
            async (..._args: FetchArgs) => new Response(null, { status: 204 }),
        );
        vi.stubGlobal('fetch', fetchFn);
        await expect(deleteColumn(5, 2)).resolves.toBeUndefined();
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('/api/reviews/5/columns/2');
        expect(init.method).toBe('DELETE');
        expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('tok/en123');
    });

    it('throws ApiError on non-2xx', async () => {
        mockFetch({ message: 'boom' }, 422);
        await expect(getReview('returns')).rejects.toThrow('boom');
    });
});
