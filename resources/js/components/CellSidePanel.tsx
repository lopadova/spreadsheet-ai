// ============================================================
// CellSidePanel — right side-panel opened by clicking a generated AI cell.
// Shows: rendered value, flag + pseudo-confidence, reasoning, citation text(s),
// the column's prompt (collapsible), and actions Regenerate / Copy value.
// Demo-grade: no real source-document viewer.
//
// The panel stays mounted while navigating (parent controls `open`); it reads
// the live cell from the shared store so a Regenerate re-stream updates it.
// ============================================================

import { useState } from 'react';
import type { AiColumn, Cell } from '../api/client';
import { formatIcon } from '../lib/formats';
import { citationText, normaliseFlag, valueToText, type Flag } from '../grid/format';

export interface CellSelection {
    rowId: string;
    columnIndex: number;
}

export interface CellSidePanelProps {
    open: boolean;
    selection: CellSelection | null;
    cell: Cell | undefined;
    column: AiColumn | undefined;
    onClose: () => void;
    /** Regenerate just this column via SSE. */
    onRegenerate: (columnIndex: number) => void;
}

const FLAG_LABEL: Record<Flag, string> = {
    green: 'High confidence',
    yellow: 'Needs review',
    red: 'Refused / low',
    grey: 'Unknown',
};

const FLAG_COLOR: Record<Flag, string> = {
    green: 'var(--status-success)',
    yellow: 'var(--status-paused)',
    red: 'var(--status-failed)',
    grey: 'var(--text-tertiary)',
};

/** Pseudo-confidence label (the backend derives it from the flag, §1.B.11). */
function confidencePct(cell: Cell | undefined): string {
    if (cell == null || cell.confidence == null || !Number.isFinite(cell.confidence)) return '—';
    return `${Math.round(Math.max(0, Math.min(1, cell.confidence)) * 100)}%`;
}

/** All citation texts as an array of readable strings. */
function citationList(citations: unknown): string[] {
    if (citations == null) return [];
    const arr = Array.isArray(citations) ? citations : [citations];
    return arr.map((c) => citationText(c)).filter((s) => s.length > 0);
}

/** Copy text to the clipboard, guarding a missing `navigator.clipboard`. */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        return false;
    }
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export function CellSidePanel({
    open,
    selection,
    cell,
    column,
    onClose,
    onRegenerate,
}: CellSidePanelProps) {
    const [promptOpen, setPromptOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!open || selection == null) return null;

    const flag = normaliseFlag(cell?.flag);
    const value = cell?.content?.summary ?? null;
    const valueText = value == null ? '—' : valueToText(value);
    const reasoning = cell?.content?.reasoning ?? null;
    const citations = citationList(cell?.content?.citations);

    const handleCopy = async () => {
        const ok = await copyToClipboard(valueText);
        setCopied(ok);
        if (ok) window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <aside className="cell-panel" data-testid="cell-side-panel" aria-label="Cell details">
            <div className="cell-panel-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className="col-fmt-ico" aria-hidden="true">{formatIcon(column?.format ?? 'text')}</span>
                    <div style={{ minWidth: 0 }}>
                        <b style={{ display: 'block', fontSize: 13 }}>{column?.name ?? 'Cell'}</b>
                        <small className="tertiary mono" style={{ fontSize: 10.5 }}>
                            {selection.rowId} · col {selection.columnIndex}
                        </small>
                    </div>
                </div>
                <button className="iconbtn" type="button" onClick={onClose} aria-label="Close panel" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="cell-panel-body">
                {/* Value */}
                <div className="cp-section">
                    <span className="cp-label">Value</span>
                    <div className="cp-value" data-testid="cp-value">{valueText}</div>
                </div>

                {/* Flag + pseudo-confidence */}
                <div className="cp-section">
                    <span className="cp-label">Confidence</span>
                    <div className="cp-flag" data-testid="cp-flag" data-flag={flag}>
                        <span className="conf-dot" style={{ background: FLAG_COLOR[flag] }} aria-hidden="true" />
                        <span>{FLAG_LABEL[flag]}</span>
                        <span className="tertiary mono" style={{ marginLeft: 'auto', fontSize: 11.5 }}>
                            {confidencePct(cell)}
                        </span>
                    </div>
                </div>

                {/* Reasoning */}
                <div className="cp-section">
                    <span className="cp-label">Reasoning</span>
                    <div className="cp-reasoning" data-testid="cp-reasoning">
                        {reasoning ?? <span className="tertiary">Nessun reasoning disponibile.</span>}
                    </div>
                </div>

                {/* Citations */}
                <div className="cp-section">
                    <span className="cp-label">Citations</span>
                    {citations.length === 0 ? (
                        <span className="tertiary" style={{ fontSize: 12 }}>Nessuna citazione.</span>
                    ) : (
                        <ul className="cp-citations" data-testid="cp-citations">
                            {citations.map((c, i) => (
                                <li key={i} className="cp-citation">
                                    <span className="cit-marker" aria-hidden="true">{i + 1}</span>
                                    <span>&quot;{c}&quot;</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Prompt (collapsible) */}
                {column?.prompt && (
                    <div className="cp-section">
                        <button
                            type="button"
                            className="cp-prompt-toggle"
                            onClick={() => setPromptOpen((v) => !v)}
                            aria-expanded={promptOpen}
                        >
                            {promptOpen ? '▾' : '▸'} Prompt
                        </button>
                        {promptOpen && (
                            <pre className="cp-prompt" data-testid="cp-prompt">{column.prompt}</pre>
                        )}
                    </div>
                )}
            </div>

            <div className="cell-panel-foot">
                <button
                    className="btn primary"
                    type="button"
                    onClick={() => onRegenerate(selection.columnIndex)}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
                    </svg>
                    Regenerate
                </button>
                <button className="btn" type="button" onClick={handleCopy}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    {copied ? 'Copied!' : 'Copy value'}
                </button>
            </div>
        </aside>
    );
}
