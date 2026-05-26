// ============================================================
// Tabular Review — typed API client
// Same-origin fetch wrapper with JSON + CSRF header for mutations.
// Contract verified live against the M2 backend.
// ============================================================

// ---- Contract types ----------------------------------------------------

export interface Review {
    id: number;
    preset_key: string;
    title: string;
    row_source: string;
}

export interface BaseColumn {
    id: string;
    name: string;
}

export interface AiColumn {
    index: number;
    name: string;
    prompt: string;
    format: string;
    enum_values?: string[];
    json_path?: string;
}

/** A data row. `row_id` is always present; the rest are base-column fields. */
export interface Row {
    row_id: string;
    [field: string]: string;
}

export interface CellContent {
    // Backend extraction can persist non-string JSON for `summary` (e.g. a
    // json_path number, or arrays/objects for tags/person/relation), so this is
    // `unknown`; render it via `valueToText`/`cellDisplayText`, never as a bare string.
    summary: unknown;
    flag: string | null;
    reasoning: string | null;
    citations: unknown;
}

export interface Cell {
    row_id: string;
    column_index: number;
    content: CellContent | null;
    flag: string | null;
    confidence: number | null;
    status: string;
}

export interface ReviewResponse {
    review: Review;
    base_columns: BaseColumn[];
    columns: AiColumn[];
    rows: Row[];
    cells: Cell[];
    suggestions_available: boolean;
}

export interface Suggestion {
    name: string;
    format: string;
    prompt: string;
    enum_values?: string[];
}

export interface SuggestionsResponse {
    preset: string;
    suggestions: Suggestion[];
}

/** Shape accepted by add/update column endpoints. */
export interface ColumnInput {
    name: string;
    prompt: string;
    format: string;
    enum_values?: string[];
    json_path?: string;
}

// ---- CSRF -------------------------------------------------------------

/** Read a cookie value by name (browser only). Returns null if absent. */
export function readCookie(name: string): string | null {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const prefix = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const trimmed = part.trim();
        if (trimmed.startsWith(prefix)) {
            return decodeURIComponent(trimmed.slice(prefix.length));
        }
    }
    return null;
}

// ---- Fetch wrapper ----------------------------------------------------

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Same-origin JSON fetch. For mutating methods, reads the Laravel
 * `XSRF-TOKEN` cookie and forwards it as the `X-XSRF-TOKEN` header.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/')) {
        throw new Error(`apiFetch only accepts same-origin absolute paths, got: ${path}`);
    }

    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (init.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (MUTATING.has(method)) {
        const token = readCookie('XSRF-TOKEN');
        if (token) headers.set('X-XSRF-TOKEN', token);
    }

    const res = await fetch(path, {
        ...init,
        method,
        headers,
        credentials: 'same-origin',
    });

    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            if (body && typeof body.message === 'string') detail = body.message;
        } catch {
            // non-JSON error body — keep statusText
        }
        throw new ApiError(detail || `Request failed (${res.status})`, res.status);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

// ---- Endpoint functions ----------------------------------------------

export function getReview(preset: string): Promise<ReviewResponse> {
    return apiFetch<ReviewResponse>(`/api/reviews/${encodeURIComponent(preset)}`);
}

export function getSuggestions(preset: string): Promise<SuggestionsResponse> {
    return apiFetch<SuggestionsResponse>(`/api/suggest/${encodeURIComponent(preset)}`);
}

// Column mutations all return the FULL refreshed review payload (the backend
// re-hydrates via ReviewHydrator), so the client can seed the cache directly.
export function addColumn(reviewId: number, col: ColumnInput): Promise<ReviewResponse> {
    return apiFetch<ReviewResponse>(`/api/reviews/${reviewId}/columns`, {
        method: 'POST',
        body: JSON.stringify(col),
    });
}

export function updateColumn(
    reviewId: number,
    index: number,
    col: Partial<ColumnInput>,
): Promise<ReviewResponse> {
    return apiFetch<ReviewResponse>(`/api/reviews/${reviewId}/columns/${index}`, {
        method: 'PATCH',
        body: JSON.stringify(col),
    });
}

export function deleteColumn(reviewId: number, index: number): Promise<ReviewResponse> {
    return apiFetch<ReviewResponse>(`/api/reviews/${reviewId}/columns/${index}`, {
        method: 'DELETE',
    });
}

/** Build the SSE stream URL (consumed via EventSource in M4). */
export function streamUrl(
    reviewId: number,
    opts: { cols?: number[]; force?: boolean } = {},
): string {
    const params = new URLSearchParams();
    if (opts.cols && opts.cols.length > 0) params.set('cols', opts.cols.join(','));
    if (opts.force) params.set('force', '1');
    const query = params.toString();
    return `/api/reviews/${reviewId}/stream${query ? `?${query}` : ''}`;
}
