// ============================================================
// AiSuggestPopover — the full AI Suggest picker (ports `editor.jsx`
// AiSuggestPopover). Lists suggestions as cards: format icon + name +
// "format · prompt-preview" + a "+" add affordance. Picking one calls onPick;
// the parent adds the column (useAddColumn) then regenerates it via SSE.
//
// Anchored under the ✨ AI Suggest button. Rendered by ActionBar when open.
// ============================================================

import { formatIcon } from '../lib/formats';
import { truncate } from '../grid/format';
import type { Suggestion } from '../api/client';

export interface AiSuggestPopoverProps {
    open: boolean;
    suggestions: Suggestion[];
    loading?: boolean;
    onPick: (s: Suggestion) => void;
    onClose: () => void;
    /** Inline positioning (top/left) anchored under the AI Suggest button. */
    anchor?: React.CSSProperties;
}

function PlusIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

function SparkleIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        </svg>
    );
}

export function AiSuggestPopover({
    open,
    suggestions,
    loading = false,
    onPick,
    onClose,
    anchor,
}: AiSuggestPopoverProps) {
    if (!open) return null;
    return (
        <>
            <div className="popover-veil" onClick={onClose} />
            <div
                className="popover ai-suggest-pop"
                role="menu"
                aria-label="AI suggested columns"
                style={anchor ?? { top: 96, left: 32 }}
            >
                <div className="popover-head">
                    <span className="badge running"><span className="dot" />AI Suggest</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Colonne suggerite dal sample reale</span>
                </div>
                <div className="popover-list">
                    {loading && <div className="empty">Caricamento…</div>}
                    {!loading && suggestions.length === 0 && (
                        <div className="empty" style={{ padding: '20px 14px' }}>
                            Niente da suggerire per questo preset.
                        </div>
                    )}
                    {!loading &&
                        suggestions.map((s) => (
                            <button
                                key={s.name}
                                type="button"
                                role="menuitem"
                                className="popover-item"
                                onClick={() => onPick(s)}
                            >
                                <span className="col-fmt-ico" style={{ flexShrink: 0 }} aria-hidden="true">
                                    {formatIcon(s.format)}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <b style={{ display: 'block', fontSize: 12.5 }}>{s.name}</b>
                                    <small className="tertiary mono" style={{ fontSize: 10.5 }}>
                                        {s.format} · {truncate(s.prompt, 56)}
                                    </small>
                                </span>
                                <PlusIcon />
                            </button>
                        ))}
                </div>
            </div>
        </>
    );
}

export { SparkleIcon };
