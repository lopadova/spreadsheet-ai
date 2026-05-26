// ============================================================
// Column width map, keyed by preset + column id.
// The API's `base_columns` / AI columns don't carry a width, so we port the
// pixel widths from the prototype `data.jsx`. Falls back to sensible defaults
// (140 for base, 160 for AI) when a column id is unknown.
// ============================================================

type WidthMap = Record<string, Record<string, number>>;

const BASE_WIDTHS: WidthMap = {
    returns: { id: 96, date: 88, customer: 160, amount: 96, reason: 220 },
    fraud: { id: 110, date: 110, customer: 170, amount: 100, country: 88 },
    articles: { sku: 110, name: 240, brand: 110, price: 90 },
    email: { id: 80, name: 260, sent: 100, opens: 80 },
    formats: { name: 220 },
};

const AI_WIDTHS: WidthMap = {
    returns: {
        reason_sem: 140, serial: 110, margin: 120, risk: 110, action: 140,
        confidence: 110, owner: 160, next: 280,
    },
    fraud: {
        risk: 100, anomaly: 150, blacklist: 120, pattern: 220, evidence: 280,
        action: 130, conf: 110,
    },
    articles: {
        desc_ok: 150, seo: 110, alt: 110, lang: 160, tags: 240, status: 140, compete: 200,
    },
    email: {
        ctr: 130, subj: 150, aud: 150, best: 220, opt: 320, owner: 150, status: 130,
    },
    formats: {
        f_text: 220, f_list: 240, f_num: 110, f_pct: 110, f_money: 130, f_cur: 100,
        f_yn: 90, f_date: 120, f_tag: 110, f_enum: 130, f_estatus: 130, f_rate: 110,
        f_url: 180, f_person: 150, f_tagsm: 200, f_rel: 180,
    },
};

const DEFAULT_BASE = 140;
const DEFAULT_AI = 160;

export function baseColumnWidth(preset: string, columnId: string): number {
    return BASE_WIDTHS[preset]?.[columnId] ?? DEFAULT_BASE;
}

/**
 * AI column width. AI columns in the API carry a numeric `index`, not the
 * prototype string id, so we accept the id when known (passed through from the
 * column ordering) and fall back to a default.
 */
export function aiColumnWidth(preset: string, columnId: string | undefined): number {
    if (columnId && AI_WIDTHS[preset]?.[columnId] != null) {
        return AI_WIDTHS[preset][columnId];
    }
    return DEFAULT_AI;
}

/**
 * Best-effort mapping from a preset + AI column ordinal to the prototype id.
 * The API preserves preset column order, so ordinal N maps to the Nth key.
 */
export function aiColumnIdByIndex(preset: string, index: number): string | undefined {
    const ids = Object.keys(AI_WIDTHS[preset] ?? {});
    return ids[index];
}
