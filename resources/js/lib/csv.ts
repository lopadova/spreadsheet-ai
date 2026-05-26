// ============================================================
// Tabular Review — CSV export (pure + unit-tested).
//
// `toCsv` serialises a header row + body rows to RFC-4180-ish CSV with two
// safety measures required by docs/RULES.md + docs/LESSON.md:
//   1. Formula neutralisation: any field beginning with `= + - @` (or a leading
//      TAB / CR, which Excel also treats as a formula trigger) is prefixed with
//      a single quote `'` so spreadsheet apps can't execute it (CSV injection).
//   2. Quoting: a field containing `"`, `,`, `\n` or `\r` is wrapped in double
//      quotes with embedded `"` doubled to `""`.
//
// `downloadCsv` is the only impure part: it triggers a client-side download via
// a Blob + object URL. It guards SSR / no-DOM environments (returns false).
// ============================================================

/** Chars that make a leading character a formula/command trigger in Excel/Sheets. */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Neutralise a single field: prefix `'` if it would be interpreted as a formula,
 * then quote/escape if it contains CSV-special characters.
 */
export function escapeCsvField(value: string): string {
    let field = value;
    if (field.length > 0 && FORMULA_PREFIXES.has(field[0])) {
        field = `'${field}`;
    }
    if (/[",\n\r]/.test(field)) {
        field = `"${field.replace(/"/g, '""')}"`;
    }
    return field;
}

/**
 * Build a CSV string from a header row and body rows. Lines are CRLF-joined
 * (RFC 4180). Every field is formula-neutralised + escaped.
 */
export function toCsv(headers: string[], rows: string[][]): string {
    const lines: string[] = [];
    lines.push(headers.map(escapeCsvField).join(','));
    for (const row of rows) {
        lines.push(row.map(escapeCsvField).join(','));
    }
    return lines.join('\r\n');
}

/**
 * Trigger a client-side download of `csv` named `filename`. No-op (returns
 * false) when there is no DOM (SSR / tests without jsdom URL support).
 */
export function downloadCsv(filename: string, csv: string): boolean {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return false;
    }
    // Prepend a UTF-8 BOM so Excel opens accented characters (é, €) correctly.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Defer revocation so the browser can capture the blob reference before
    // the URL is invalidated (synchronous revoke can race the download start).
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
}
