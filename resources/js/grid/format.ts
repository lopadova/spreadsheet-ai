// ============================================================
// Tabular Review — pure format helpers (unit-tested).
// Used by the canvas renderers and the offscreen a11y mirror.
// These are deliberately side-effect-free so Vitest can cover the
// prototype bugs we are fixing here (plan §1.A findings 1,2,3,5).
// ============================================================

/** Confidence flag → palette key. Unknown flags fall back to grey. */
export type Flag = 'green' | 'yellow' | 'red' | 'grey';

export function normaliseFlag(flag: string | null | undefined): Flag {
    switch (flag) {
        case 'green':
        case 'yellow':
        case 'red':
        case 'grey':
            return flag;
        default:
            return 'grey';
    }
}

/**
 * Parse a percentage-ish value into a finite number, or `null` when it cannot
 * be interpreted. Fixes prototype bug §1.A.5: never let `NaN` reach width/color
 * math. Accepts `'+18%'`, `'-42%'`, `'24.8'`, `24`, `'76,5%'` (Italian comma).
 */
export function parsePercent(raw: unknown): number | null {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace('%', '').replace(',', '.').trim();
    if (cleaned === '') return null;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

/** Sign of the original percentage string ('+', '-' prefix) for coloring. */
export function percentSign(raw: unknown): 'pos' | 'neg' | 'neutral' {
    const s = String(raw ?? '').trim();
    if (s.startsWith('-')) return 'neg';
    if (s.startsWith('+')) return 'pos';
    return 'neutral';
}

/** Detected primitive type for a json_path value (fixes prototype bug §1.A.1). */
export type JsonPathType = 'percentage' | 'money' | 'number' | 'date' | 'text';

const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?$/;
const MONEY_RE = /^[+-]?[\d.,]+\s*(?:EUR|USD|GBP|€|\$|£)$/i;
const NUMBER_RE = /^[+-]?\d[\d.,]*$/;

/**
 * Auto-detect how a json_path value should render. The prototype always
 * delegated to the percentage renderer (a stub); we inspect the value.
 */
export function detectJsonPathType(raw: unknown): JsonPathType {
    if (typeof raw === 'number') return 'number';
    if (typeof raw !== 'string') return 'text';
    const s = raw.trim();
    if (s === '') return 'text';
    if (s.endsWith('%')) return 'percentage';
    if (DATE_RE.test(s)) return 'date';
    if (MONEY_RE.test(s)) return 'money';
    if (NUMBER_RE.test(s)) {
        // A bare integer 0..100 is ambiguous; treat as number unless it has a %.
        return 'number';
    }
    return 'text';
}

/**
 * Stable hue 0..359 from a string. Deterministic so the same enum/tag value
 * always gets the same color across renders and presets (plan §1.A.4 decision:
 * deterministic hash is fine for the demo).
 */
export function deterministicHue(s: unknown): number {
    const str = String(s ?? '');
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 360;
}

/** Truncate to `n` chars with an ellipsis. */
export function truncate(s: unknown, n: number): string {
    const str = s == null ? '' : String(s);
    if (n <= 0) return '';
    return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/**
 * Whether a URL is safe to render as a clickable link / pass to window.open.
 * Only http(s) (fixes prototype bug §1.A.5 / security rule: reject javascript:,
 * data:, etc.).
 */
export function isSafeUrl(raw: unknown): boolean {
    if (typeof raw !== 'string' || raw.trim() === '') return false;
    try {
        const u = new URL(raw);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

/** Extract the display host from a URL, falling back to the raw string. */
export function urlHost(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    try {
        return new URL(raw).hostname.replace(/^www\./, '');
    } catch {
        return raw;
    }
}

/**
 * A flat, human-readable string for any cell value (used by the a11y mirror,
 * copyData, and the text fallback renderer). Arrays join with " · ",
 * person/relation objects stringify their label.
 */
export function valueToText(value: unknown): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((v) => valueToText(v)).join(' · ');
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (typeof obj.name === 'string') return obj.name;
        if (typeof obj.label === 'string') return obj.label;
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Plain display text for an AI cell — the single source of truth shared by the
 * canvas grid mirror (AgenticGrid) and the CSV export (exportReview), so the two
 * never drift. Generating/pending/missing → '', null summary → '—', rating →
 * clamped 'n/5', else `valueToText`.
 */
export function cellDisplayText(
    cell: { status?: string | null; content?: { summary?: unknown } | null } | null | undefined,
    format: string,
): string {
    if (cell == null) return '';
    if (cell.status === 'generating' || cell.status === 'pending') return '';
    const value = cell.content?.summary ?? null;
    if (value == null) return '—';
    if (format === 'rating') {
        const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        return Number.isFinite(n) ? `${Math.max(0, Math.min(5, n))}/5` : '—';
    }
    return valueToText(value);
}

/** Number of citations a cell carries (citations may be strings or objects). */
export function citationCount(citations: unknown): number {
    if (Array.isArray(citations)) return citations.length;
    if (citations == null) return 0;
    return 1;
}

/** First citation as a readable string (handles {quote} objects + plain strings). */
export function citationText(citations: unknown): string {
    const first = Array.isArray(citations) ? citations[0] : citations;
    if (first == null) return '';
    if (typeof first === 'string') return first;
    if (typeof first === 'object') {
        const obj = first as Record<string, unknown>;
        if (typeof obj.quote === 'string') return obj.quote;
        if (typeof obj.text === 'string') return obj.text;
        return JSON.stringify(first);
    }
    return String(first);
}
