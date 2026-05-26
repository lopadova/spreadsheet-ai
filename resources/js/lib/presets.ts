// Static chrome metadata for the 5 presets (emoji/label/sub + singular entity
// name for the footer). Matches the backend preset keys; data itself is loaded
// from the API.

export interface PresetMeta {
    id: string;
    emoji: string;
    label: string;
    sub: string;
    /** Singular Italian entity name for the footer count. */
    entity: string;
    /** Plural Italian entity name (Italian plurals are irregular). */
    entityPlural: string;
}

export const PRESETS: PresetMeta[] = [
    { id: 'returns', emoji: '🛒', label: 'Triage Resi', sub: 'Customer service · settimanale', entity: 'Reso', entityPlural: 'Resi' },
    { id: 'fraud', emoji: '🚨', label: 'Frode Ordini', sub: 'Risk · 48h', entity: 'Ordine', entityPlural: 'Ordini' },
    { id: 'articles', emoji: '📦', label: 'Audit Schede', sub: 'Catalogo · SS26', entity: 'Articolo', entityPlural: 'Articoli' },
    { id: 'email', emoji: '💌', label: 'Audit Campagne', sub: 'Email marketing', entity: 'Campagna', entityPlural: 'Campagne' },
    { id: 'formats', emoji: '🌈', label: 'Tutti i 17 formati', sub: 'Showcase renderer', entity: 'Esempio', entityPlural: 'Esempi' },
];

export const DEFAULT_PRESET = PRESETS[0].id;

export function presetMeta(id: string): PresetMeta {
    return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
