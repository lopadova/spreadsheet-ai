// ============================================================
// Shared format metadata — the 17 column formats (16 LLM + json_path bonus).
// Ported from the prototype `data.jsx` FORMATS map. Single source of truth for
// icon + label + sub used by the ColumnEditor format picker, the AI Suggest
// popover, the grid header icons, and the cell side-panel.
// ============================================================

export interface FormatMeta {
    /** Short label shown on the picker card. */
    label: string;
    /** One-line description shown under the label. */
    sub: string;
    /** Monospace glyph icon. */
    ico: string;
}

/** All 17 formats keyed by their backend format key. */
export const FORMATS: Record<string, FormatMeta> = {
    text: { label: 'Text', sub: 'Free text answer', ico: 'Aa' },
    bulleted_list: { label: 'List', sub: 'Bullet points (max 5)', ico: '•' },
    number: { label: 'Number', sub: 'Integer / decimal', ico: '#' },
    percentage: { label: 'Percentage', sub: '0–100%', ico: '%' },
    monetary_amount: { label: 'Money', sub: 'amount + currency', ico: '€' },
    currency: { label: 'Currency', sub: 'ISO-4217 code', ico: '¤' },
    yes_no: { label: 'Yes / No', sub: 'binary classifier', ico: '?' },
    date: { label: 'Date', sub: 'ISO-8601 YYYY-MM-DD', ico: '⌗' },
    tag: { label: 'Tag', sub: 'single label', ico: '#' },
    enum: { label: 'Enum', sub: 'one of N values', ico: '◉' },
    enum_status: { label: 'Status', sub: 'todo / wip / done / block', ico: '⬤' },
    rating: { label: 'Rating', sub: '1–5 stars', ico: '★' },
    url: { label: 'URL', sub: 'external link', ico: '↗' },
    person: { label: 'Person', sub: 'user lookup', ico: '◍' },
    tags_multi: { label: 'Tags', sub: 'multiple labels', ico: '⌗⌗' },
    relation: { label: 'Relation', sub: 'link to entity', ico: '⇄' },
    json_path: { label: 'JSON Path', sub: 'no LLM call (free)', ico: '$' },
};

/** The 16 LLM format keys (order matters for the picker grid). */
export const FORMAT_KEYS: string[] = [
    'text', 'bulleted_list', 'number', 'percentage', 'monetary_amount', 'currency',
    'yes_no', 'date', 'tag', 'enum', 'enum_status', 'rating', 'url', 'person',
    'tags_multi', 'relation',
];

/** All 17 keys including json_path (used by the format picker). */
export const ALL_FORMAT_KEYS: string[] = [...FORMAT_KEYS, 'json_path'];

/** Icon glyph for a format key, with a graceful fallback. */
export function formatIcon(format: string): string {
    return FORMATS[format]?.ico ?? '◇';
}

/**
 * Per-format sample prompt generator (ported from `editor.jsx` Auto-generate).
 * Client-side only — no API call. `json_path` yields a JSON Path expression,
 * everything else a natural-language prompt.
 */
export function autoGeneratePrompt(format: string, label: string): string {
    const field = label || 'questo campo';
    const samples: Record<string, string> = {
        text: `Restituisci una sintesi concisa di "${field}" basata sui dati riga (max 200 char).`,
        bulleted_list: `Elenca 3-5 punti chiave relativi a "${field}" come bulleted list markdown.`,
        number: `Calcola il valore numerico di "${field}".`,
        percentage: `Stima "${field}" come percentuale 0-100%.`,
        monetary_amount: `Calcola "${field}" come importo + codice valuta ISO. Es: 119.00 EUR.`,
        yes_no: `Rispondi Yes/No alla domanda: "${field}?"`,
        date: `Restituisci la data ISO-8601 relativa a "${field}".`,
        enum: `Classifica "${field}" in UNA delle categorie ammesse.`,
        enum_status: `Determina lo stato di "${field}" tra todo/in_progress/done/blocked.`,
        rating: `Valuta "${field}" su una scala 1-5.`,
        url: `Restituisci un URL canonico per "${field}".`,
        person: `Suggerisci la persona responsabile per "${field}".`,
        tags_multi: `Restituisci 3-5 tag rilevanti per "${field}".`,
        relation: `Restituisci l'entità correlata per "${field}". Es: clienti:12345.`,
        currency: `Restituisci il codice valuta ISO-4217 di "${field}".`,
        tag: `Restituisci una sola etichetta breve (1-3 parole) per "${field}".`,
        json_path: `$.metadata.${(label || 'field').toLowerCase().replace(/\s+/g, '_')}`,
    };
    return samples[format] ?? samples.text;
}
