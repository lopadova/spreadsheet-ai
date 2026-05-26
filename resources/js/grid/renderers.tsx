// ============================================================
// AgenticCell — ONE Glide custom renderer that draws all 17 AI cell formats
// on canvas. Ports the visual treatments from the prototype `cells.jsx` and
// fixes its bugs (json_path auto-detect, NaN-guarded percentage, stable
// citation index, http(s)-only url).
// ============================================================

import {
    GridCellKind,
    type CustomCell,
    type CustomRenderer,
    type Rectangle,
    type Theme,
} from '@glideapps/glide-data-grid';
import {
    citationCount,
    deterministicHue,
    detectJsonPathType,
    isSafeUrl,
    normaliseFlag,
    parsePercent,
    percentSign,
    truncate,
    urlHost,
    valueToText,
    type Flag,
} from './format';

export interface AgenticCellData {
    readonly kind: 'agentic-cell';
    readonly format: string;
    /** Raw value (string | number | string[] | {name,initials,hue} | {kind,label}). */
    readonly value: unknown;
    readonly flag: Flag;
    readonly confidence: number | null;
    /** Stable 1-based citation index, or null. */
    readonly citationIndex: number | null;
    readonly citationCount: number;
    readonly enumValues?: string[];
}

export type AgenticCell = CustomCell<AgenticCellData>;

// ---- Palette (resolved from CSS tokens at theme-build time) ----
// We read concrete colors off the Glide theme where possible, but flags/status
// need their own swatches. These mirror app.css status tokens.
const FLAG_DOT: Record<Flag, string> = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    grey: '#71717a',
};

const FLAG_TINT: Record<Flag, string> = {
    green: 'rgba(16,185,129,0.08)',
    yellow: 'rgba(245,158,11,0.10)',
    red: 'rgba(239,68,68,0.10)',
    grey: 'rgba(113,113,122,0.06)',
};

const STATUS_PALETTE: Record<string, { c: string; bg: string }> = {
    todo: { c: '#a1a1a8', bg: 'rgba(113,113,122,0.16)' },
    in_progress: { c: '#f59e0b', bg: 'rgba(245,158,11,0.16)' },
    done: { c: '#10b981', bg: 'rgba(16,185,129,0.16)' },
    blocked: { c: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
    expired: { c: '#6e6e76', bg: 'rgba(113,113,122,0.12)' },
};

const REL_ICON: Record<string, string> = {
    customer: '◍', article: '▣', order: '⊞', campaign: '✉', return: '↩',
};

const PAD = 8;

function setFont(ctx: CanvasRenderingContext2D, theme: Theme, weight = ''): void {
    ctx.font = `${weight} ${theme.baseFontStyle} ${theme.fontFamily}`.trim();
}

// Draw a rounded rect path.
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

interface DrawCtx {
    ctx: CanvasRenderingContext2D;
    theme: Theme;
    rect: Rectangle;
    cy: number; // vertical center
    textColor: string;
    mutedColor: string;
    /** Right boundary available for value drawing (before dot/badge). */
    rightLimit: number;
}

// ---------- Per-format drawing helpers (return nothing; draw at rect). ----------

function drawPill(d: DrawCtx, x: number, text: string, fg: string, bg: string, dot?: string): number {
    const { ctx, theme } = d;
    setFont(ctx, theme, '500');
    const tw = ctx.measureText(text).width;
    const dotW = dot ? 12 : 0;
    const w = tw + 16 + dotW;
    const h = 18;
    const y = d.cy - h / 2;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    let tx = x + 8;
    if (dot) {
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(tx + 2, d.cy, 3, 0, Math.PI * 2);
        ctx.fill();
        tx += dotW;
    }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tx, d.cy);
    return x + w;
}

function drawText(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    setFont(ctx, theme);
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    const max = Math.floor((d.rightLimit - rect.x - PAD) / 6.4);
    ctx.fillText(truncate(valueToText(value), Math.max(4, max)), rect.x + PAD, d.cy);
}

function drawBulletList(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const items = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
    setFont(ctx, theme);
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    const max = Math.floor((d.rightLimit - rect.x - PAD) / 6.0);
    const joined = items.map((t) => `• ${t}`).join('   ');
    ctx.fillText(truncate(joined, Math.max(6, max)), rect.x + PAD, d.cy);
}

const MONO = "'Geist Mono', ui-monospace, monospace";

function drawNumber(d: DrawCtx, value: unknown): void {
    const { ctx, rect } = d;
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(truncate(valueToText(value), 24), rect.x + PAD, d.cy);
}

function drawPercentage(d: DrawCtx, value: unknown): void {
    const { ctx, rect } = d;
    const n = parsePercent(value); // NaN-guarded (§1.A.5)
    const sign = percentSign(value);
    const display = n == null ? '—' : typeof value === 'string' && value.includes('%') ? value : `${n}%`;
    const pct = n == null ? 0 : Math.max(0, Math.min(100, Math.abs(n)));
    const barColor = sign === 'neg' ? FLAG_DOT.red : sign === 'pos' ? FLAG_DOT.green : '#8b5cf6';

    const barW = Math.min(48, d.rightLimit - rect.x - 64);
    const barX = rect.x + PAD;
    const barH = 5;
    const barY = d.cy - barH / 2;
    if (barW > 8) {
        ctx.fillStyle = 'rgba(127,127,135,0.25)';
        roundRect(ctx, barX, barY, barW, barH, 2.5);
        ctx.fill();
        if (pct > 0) {
            ctx.fillStyle = barColor;
            roundRect(ctx, barX, barY, (barW * pct) / 100, barH, 2.5);
            ctx.fill();
        }
    }
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(display, barX + (barW > 8 ? barW + 8 : 0), d.cy);
}

function drawMoney(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const [amt, cur] = String(valueToText(value)).split(' ');
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(amt ?? '', rect.x + PAD, d.cy);
    if (cur) {
        const ax = rect.x + PAD + ctx.measureText(`${amt} `).width;
        setFont(ctx, theme, '500');
        ctx.fillStyle = d.mutedColor;
        ctx.fillText(cur, ax + 4, d.cy);
    }
}

function drawYesNo(d: DrawCtx, value: unknown): void {
    const isYes = String(valueToText(value)).toLowerCase() === 'yes';
    drawPill(
        d,
        d.rect.x + PAD,
        valueToText(value) || '—',
        isYes ? FLAG_DOT.green : d.mutedColor,
        isYes ? 'rgba(16,185,129,0.14)' : 'rgba(113,113,122,0.12)',
        isYes ? FLAG_DOT.green : d.mutedColor,
    );
}

function drawDate(d: DrawCtx, value: unknown): void {
    const { ctx, rect } = d;
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = d.textColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(valueToText(value), rect.x + PAD, d.cy);
}

function drawHuedPill(d: DrawCtx, value: unknown): void {
    const v = valueToText(value) || '—';
    const hue = deterministicHue(v);
    drawPill(d, d.rect.x + PAD, v, `oklch(0.85 0.12 ${hue})`, `oklch(0.5 0.12 ${hue} / 0.22)`);
}

function drawEnumStatus(d: DrawCtx, value: unknown): void {
    const v = String(valueToText(value));
    const p = STATUS_PALETTE[v] ?? STATUS_PALETTE.todo;
    drawPill(d, d.rect.x + PAD, v.replace('_', ' '), p.c, p.bg, p.c);
}

function drawRating(d: DrawCtx, value: unknown): void {
    const { ctx, rect } = d;
    const parsed = parsePercent(value);
    const n = Math.max(0, Math.min(5, parsed == null ? 0 : Math.round(parsed)));
    const color = n >= 4 ? FLAG_DOT.red : n === 3 ? FLAG_DOT.yellow : d.textColor;
    ctx.fillStyle = color;
    ctx.font = '12px ui-sans-serif, sans-serif';
    ctx.textBaseline = 'middle';
    let x = rect.x + PAD;
    for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = i < n ? 1 : 0.28;
        ctx.fillText('★', x, d.cy);
        x += 13;
    }
    ctx.globalAlpha = 1;
    ctx.font = `12px ${MONO}`;
    ctx.fillStyle = d.mutedColor;
    ctx.fillText(`${n}/5`, x + 4, d.cy);
}

function drawUrl(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const raw = valueToText(value);
    const safe = isSafeUrl(raw); // http(s) only (§1.A.5 / security)
    const host = urlHost(raw);
    const hue = deterministicHue(host);
    let x = rect.x + PAD;
    if (safe) {
        ctx.fillStyle = `oklch(0.7 0.15 ${hue})`;
        ctx.beginPath();
        ctx.arc(x + 3, d.cy, 3, 0, Math.PI * 2);
        ctx.fill();
        x += 12;
    }
    setFont(ctx, theme);
    ctx.fillStyle = safe ? '#8b5cf6' : d.mutedColor;
    ctx.textBaseline = 'middle';
    const max = Math.floor((d.rightLimit - x - 14) / 6.4);
    ctx.fillText(truncate(safe ? host : raw, Math.max(6, max)), x, d.cy);
    if (safe) {
        const w = ctx.measureText(truncate(host, Math.max(6, max))).width;
        ctx.fillText('↗', x + w + 4, d.cy);
    }
}

function drawPerson(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const p = (value ?? {}) as { name?: string; initials?: string; hue?: number };
    const hue = typeof p.hue === 'number' ? p.hue : deterministicHue(p.name ?? '');
    const r = 9;
    const ax = rect.x + PAD + r;
    ctx.fillStyle = `oklch(0.55 0.15 ${hue})`;
    ctx.beginPath();
    ctx.arc(ax, d.cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 9px ui-sans-serif, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(p.initials ?? '?', ax, d.cy);
    ctx.textAlign = 'left';
    setFont(ctx, theme);
    ctx.fillStyle = d.textColor;
    const tx = ax + r + 6;
    const max = Math.floor((d.rightLimit - tx) / 6.4);
    ctx.fillText(truncate(p.name ?? '', Math.max(4, max)), tx, d.cy);
}

function drawTagsMulti(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const tags = Array.isArray(value) ? value.map(String) : [];
    if (tags.length === 0) {
        ctx.fillStyle = d.mutedColor;
        setFont(ctx, theme);
        ctx.textBaseline = 'middle';
        ctx.fillText('—', rect.x + PAD, d.cy);
        return;
    }
    let x = rect.x + PAD;
    const h = 16;
    const y = d.cy - h / 2;
    let shown = 0;
    for (const t of tags) {
        setFont(ctx, theme, '500');
        const tw = ctx.measureText(t).width;
        const w = tw + 12;
        if (x + w > d.rightLimit - 22 && shown > 0) break;
        const hue = deterministicHue(t);
        ctx.fillStyle = `oklch(0.5 0.1 ${hue} / 0.28)`;
        roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = `oklch(0.85 0.11 ${hue})`;
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x + 6, d.cy);
        x += w + 4;
        shown++;
    }
    const extra = tags.length - shown;
    if (extra > 0) {
        setFont(ctx, theme, '500');
        const label = `+${extra}`;
        const w = ctx.measureText(label).width + 10;
        ctx.fillStyle = 'rgba(127,127,135,0.2)';
        roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = d.mutedColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 5, d.cy);
    }
}

function drawRelation(d: DrawCtx, value: unknown): void {
    const { ctx, theme, rect } = d;
    const v = (value ?? {}) as { kind?: string; label?: string };
    setFont(ctx, theme);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8b5cf6';
    ctx.fillText(REL_ICON[v.kind ?? ''] ?? '◇', rect.x + PAD, d.cy);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = d.textColor;
    ctx.fillText(truncate(v.label ?? '', 28), rect.x + PAD + 18, d.cy);
}

function drawJsonPath(d: DrawCtx, value: unknown): void {
    const { ctx, rect } = d;
    // `$` sigil first.
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#8b5cf6';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', rect.x + PAD, d.cy);
    const inner: DrawCtx = { ...d, rect: { ...rect, x: rect.x + 12 } };
    const type = detectJsonPathType(value); // auto-detect (§1.A.1)
    switch (type) {
        case 'percentage':
            drawPercentage(inner, value);
            break;
        case 'money':
            drawMoney(inner, value);
            break;
        case 'number':
            drawNumber(inner, value);
            break;
        case 'date':
            drawDate(inner, value);
            break;
        default:
            drawText(inner, value);
    }
}

// ---------- Chrome: flag tint, confidence tint, dot, citation badge ----------

function drawFlagBackground(ctx: CanvasRenderingContext2D, rect: Rectangle, flag: Flag): void {
    ctx.fillStyle = FLAG_TINT[flag];
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawConfidenceTint(ctx: CanvasRenderingContext2D, rect: Rectangle, confidence: number | null): void {
    if (confidence != null && confidence < 0.85) {
        const opacity = (1 - confidence) * 0.1;
        ctx.fillStyle = `rgba(254,202,202,${opacity})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
}

function drawConfidenceDot(ctx: CanvasRenderingContext2D, x: number, y: number, flag: Flag): void {
    ctx.fillStyle = FLAG_DOT[flag];
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawCitationBadge(ctx: CanvasRenderingContext2D, x: number, y: number, idx: number): void {
    const label = String(idx);
    ctx.font = `bold 9px ${MONO}`;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(139,92,246,0.18)';
    roundRect(ctx, x - w, y, w, 13, 4);
    ctx.fill();
    ctx.fillStyle = '#8b5cf6';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(label, x - w / 2, y + 7);
    ctx.textAlign = 'left';
}

// ---------- The renderer ----------

export const agenticCellRenderer: CustomRenderer<AgenticCell> = {
    kind: GridCellKind.Custom,
    isMatch: (cell): cell is AgenticCell =>
        (cell.data as { kind?: string }).kind === 'agentic-cell',
    draw: (args, cell) => {
        const { ctx, theme, rect } = args;
        const data = cell.data;
        const flag = data.flag;

        ctx.save();
        // Background tint + confidence overlay.
        drawFlagBackground(ctx, rect, flag);
        drawConfidenceTint(ctx, rect, data.confidence);

        const hasCitation = data.citationIndex != null;
        const dotW = 12;
        const citW = hasCitation ? 22 : 0;
        const d: DrawCtx = {
            ctx,
            theme,
            rect,
            cy: rect.y + rect.height / 2,
            textColor: theme.textDark,
            mutedColor: theme.textLight,
            rightLimit: rect.x + rect.width - dotW - citW,
        };

        if (data.value == null || (typeof data.value === 'string' && data.value === '')) {
            ctx.fillStyle = d.mutedColor;
            setFont(ctx, theme);
            ctx.textBaseline = 'middle';
            ctx.fillText('—', rect.x + PAD, d.cy);
        } else {
            drawByFormat(d, data);
        }

        // Citation badge (stable index) top-right.
        if (data.citationIndex != null) {
            drawCitationBadge(ctx, rect.x + rect.width - 6, rect.y + 4, data.citationIndex);
        }
        // Confidence dot, right edge mid.
        drawConfidenceDot(ctx, rect.x + rect.width - 7, d.cy, flag);

        ctx.restore();
        return true;
    },
};

function drawByFormat(d: DrawCtx, data: AgenticCellData): void {
    switch (data.format) {
        case 'text':
            return drawText(d, data.value);
        case 'bulleted_list':
            return drawBulletList(d, data.value);
        case 'number':
            return drawNumber(d, data.value);
        case 'percentage':
            return drawPercentage(d, data.value);
        case 'monetary_amount':
            return drawMoney(d, data.value);
        case 'currency':
            return drawText(d, data.value);
        case 'yes_no':
            return drawYesNo(d, data.value);
        case 'date':
            return drawDate(d, data.value);
        case 'tag':
            return drawHuedPill(d, data.value);
        case 'enum':
            return drawHuedPill(d, data.value);
        case 'enum_status':
            return drawEnumStatus(d, data.value);
        case 'rating':
            return drawRating(d, data.value);
        case 'url':
            return drawUrl(d, data.value);
        case 'person':
            return drawPerson(d, data.value);
        case 'tags_multi':
            return drawTagsMulti(d, data.value);
        case 'relation':
            return drawRelation(d, data.value);
        case 'json_path':
            return drawJsonPath(d, data.value);
        default:
            return drawText(d, data.value); // graceful fallback: always show value
    }
}

/** Used by both the canvas (copyData) and the offscreen a11y mirror. */
export function cellSummaryText(data: AgenticCellData): string {
    if (data.format === 'rating') {
        const n = parsePercent(data.value);
        return n == null ? '' : `${Math.max(0, Math.min(5, Math.round(n)))}/5`;
    }
    if (data.format === 'percentage' || data.format === 'json_path') {
        return valueToText(data.value);
    }
    return valueToText(data.value);
}

export { citationCount, normaliseFlag };
