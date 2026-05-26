// ============================================================
// ColumnEditor — right-side drawer for creating / editing an AI column.
// Ports the prototype `editor.jsx` ColumnEditor + FormatPickerCard:
//   Label · 17-format picker · conditional enum-values · Prompt textarea
//   (or JSON Path input) with client-side Auto-generate · json_path help line ·
//   cost-estimate card. Footer: Cancel · Save & regenerate (+ Delete in edit).
//
// The component is presentation + form logic only. The parent wires the
// mutation (add/update) and the SSE regenerate via `onSubmit`, keeping the
// payload-building logic unit-testable without TanStack Query / EventSource.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_FORMAT_KEYS, FORMATS, autoGeneratePrompt } from '../lib/formats';
import type { AiColumn, ColumnInput } from '../api/client';

export type ColumnEditorMode = 'new' | 'edit';

export interface ColumnEditorProps {
    open: boolean;
    mode: ColumnEditorMode;
    /** The column being edited (mode === 'edit'); ignored for 'new'. */
    column?: AiColumn | null;
    /**
     * Build + persist the column. The parent runs the add/update mutation and,
     * once the review is refetched, triggers `runColumns([index])`.
     */
    onSubmit: (payload: ColumnInput, mode: ColumnEditorMode, index?: number) => void;
    /** Delete the column being edited (edit mode only). */
    onDelete?: (index: number) => void;
    onClose: () => void;
    saving?: boolean;
}

function FormatPickerCard({
    formatKey,
    active,
    onClick,
}: {
    formatKey: string;
    active: boolean;
    onClick: () => void;
}) {
    const f = FORMATS[formatKey];
    return (
        <button
            className={`fmt-card ${active ? 'active' : ''}`}
            onClick={onClick}
            type="button"
            aria-pressed={active}
            title={f.label}
        >
            <span className="fmt-card-ico" aria-hidden="true">{f.ico}</span>
            <span className="fmt-card-label">{f.label}</span>
            <span className="fmt-card-sub">{f.sub}</span>
        </button>
    );
}

/** Build the API payload from the current form state. Exported for tests. */
export function buildColumnPayload(args: {
    name: string;
    format: string;
    prompt: string;
    enumValues: string;
}): ColumnInput {
    const { name, format, prompt, enumValues } = args;
    const payload: ColumnInput = {
        name: name.trim(),
        format,
        prompt: prompt.trim(),
    };
    if (format === 'enum') {
        payload.enum_values = enumValues
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (format === 'json_path') {
        // json_path is LLM-free: the path lives in `json_path`, prompt mirrors it.
        payload.json_path = prompt.trim();
    }
    return payload;
}

export function ColumnEditor({
    open,
    mode,
    column,
    onSubmit,
    onDelete,
    onClose,
    saving = false,
}: ColumnEditorProps) {
    const [name, setName] = useState('');
    const [format, setFormat] = useState('text');
    const [prompt, setPrompt] = useState('');
    const [enumValues, setEnumValues] = useState('');
    const [autogenerating, setAutogen] = useState(false);

    // (Re)seed the form whenever the drawer opens or the target column changes.
    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && column) {
            setName(column.name ?? '');
            const fmt = column.format === 'json_path' || (column.json_path != null && column.json_path !== '')
                ? 'json_path'
                : (column.format ?? 'text');
            setFormat(fmt);
            setPrompt(fmt === 'json_path' ? (column.json_path ?? column.prompt ?? '') : (column.prompt ?? ''));
            setEnumValues((column.enum_values ?? []).join(', '));
        } else {
            setName('');
            setFormat('text');
            setPrompt('');
            setEnumValues('');
        }
        setAutogen(false);
    }, [open, mode, column]);

    // Close on Escape (dialog role requires it per ARIA spec).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const isJsonPath = format === 'json_path';

    const autogenTimerRef = useRef<number | null>(null);
    const autoGenerate = () => {
        if (autogenTimerRef.current != null) clearTimeout(autogenTimerRef.current);
        setAutogen(true);
        // Match the prototype's short async feel; purely client-side.
        autogenTimerRef.current = window.setTimeout(() => {
            setPrompt(autoGeneratePrompt(format, name));
            setAutogen(false);
            autogenTimerRef.current = null;
        }, 120);
    };

    // Clear a pending auto-generate timer when the drawer closes or unmounts,
    // so a late setState can't fire on a hidden/unmounted editor.
    useEffect(() => {
        if (!open && autogenTimerRef.current != null) {
            clearTimeout(autogenTimerRef.current);
            autogenTimerRef.current = null;
        }
        return () => {
            if (autogenTimerRef.current != null) {
                clearTimeout(autogenTimerRef.current);
                autogenTimerRef.current = null;
            }
        };
    }, [open]);

    // Client-side validation mirrors the backend ColumnRequest rules so an
    // invalid Save can't round-trip to a 422.
    const enumList = enumValues.split(',').map((s) => s.trim()).filter(Boolean);
    const validationError =
        name.trim() === ''
            ? 'Label obbligatoria.'
            : format === 'enum' && enumList.length === 0
                ? 'Per il formato enum serve almeno un valore.'
                : format === 'json_path' && prompt.trim() === ''
                    ? 'Il JSON Path è obbligatorio.'
                    : null;

    const cost = useMemo(() => {
        if (isJsonPath) {
            return { tokens: '0 token', euro: '€0.00 (free)', latency: '< 5ms', free: true };
        }
        return {
            tokens: '~ 240 token in / 80 out',
            euro: `€${(0.0008 * 14).toFixed(4)}`,
            latency: '~ 1.8s/row',
            free: false,
        };
    }, [isJsonPath]);

    if (!open) return null;

    const handleSave = () => {
        if (validationError !== null) return;
        const payload = buildColumnPayload({ name, format, prompt, enumValues });
        onSubmit(payload, mode, mode === 'edit' ? column?.index : undefined);
    };

    const handleDelete = () => {
        if (mode !== 'edit' || column == null) return;
        if (typeof window !== 'undefined' && !window.confirm(`Eliminare la colonna "${column.name}"?`)) {
            return;
        }
        onDelete?.(column.index);
    };

    return (
        <div role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'New AI column' : 'Edit AI column'}>
            <div className="overlay" onClick={onClose} />
            <div className="drawer wide-drawer" data-testid="column-editor">
                <div className="drawer-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge running"><span className="dot" />AI Column</span>
                        <strong style={{ fontSize: 13 }}>{mode === 'new' ? 'New AI column' : 'Edit AI column'}</strong>
                    </div>
                    <button className="iconbtn" type="button" onClick={onClose} aria-label="Close editor" title="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="drawer-body" style={{ padding: '18px 20px 24px' }}>
                    {/* Label */}
                    <div className="form-row">
                        <label htmlFor="ce-label">Label</label>
                        <input
                            id="ce-label"
                            className="input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Risk score frode"
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                        />
                    </div>

                    {/* Format picker */}
                    <div className="form-row">
                        <label>
                            Format <span className="tertiary mono" style={{ marginLeft: 6 }} data-testid="ce-format">{format}</span>
                        </label>
                        <div className="fmt-grid" role="group" aria-label="Column format">
                            {ALL_FORMAT_KEYS.map((k) => (
                                <FormatPickerCard
                                    key={k}
                                    formatKey={k}
                                    active={k === format}
                                    onClick={() => setFormat(k)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Enum values (conditional) */}
                    {format === 'enum' && (
                        <div className="form-row">
                            <label htmlFor="ce-enum">Enum values (comma-separated)</label>
                            <input
                                id="ce-enum"
                                className="input"
                                value={enumValues}
                                onChange={(e) => setEnumValues(e.target.value)}
                                placeholder="Low, Medium, High, Critical"
                            />
                        </div>
                    )}

                    {/* Prompt / JSON Path */}
                    <div className="form-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label htmlFor="ce-prompt" style={{ margin: 0 }}>{isJsonPath ? 'JSON Path' : 'Prompt'}</label>
                            {!isJsonPath && (
                                <button
                                    className="btn sm ghost autogen-btn"
                                    type="button"
                                    onClick={autoGenerate}
                                    disabled={autogenerating}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /></svg>
                                    {autogenerating ? 'Generating…' : 'Auto-generate'}
                                </button>
                            )}
                        </div>
                        <textarea
                            id="ce-prompt"
                            className="input prompt-input"
                            rows={5}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={isJsonPath ? '$.metadata.status' : 'Descrivi in linguaggio naturale cosa estrarre dalla riga…'}
                            style={{ fontFamily: isJsonPath ? 'var(--font-mono)' : 'inherit' }}
                        />
                        <div className="tertiary" style={{ fontSize: 11, marginTop: 4 }}>
                            {isJsonPath
                                ? '⚡ json_path bypassa l’LLM — risolve direttamente sul JSON di contesto. Latency O(1), zero token.'
                                : 'Il prompt è eseguito su ogni riga con il contesto chunk + frontmatter. Il format suffix è iniettato automaticamente.'}
                        </div>
                    </div>

                    {/* Cost estimate */}
                    <div className="cost-card">
                        <div>
                            <small className="tertiary">Stima per {isJsonPath ? 'riga' : 'regeneration'}</small>
                            <b className="mono">{cost.tokens}</b>
                        </div>
                        <div>
                            <small className="tertiary">Costo stimato</small>
                            <b className="mono" style={{ color: 'var(--accent)' }}>{cost.euro}</b>
                        </div>
                        <div>
                            <small className="tertiary">Latency stimata</small>
                            <b className="mono">{cost.latency}</b>
                        </div>
                    </div>
                </div>

                <div className="drawer-foot">
                    {mode === 'edit' && (
                        <button
                            className="btn sm danger"
                            type="button"
                            onClick={handleDelete}
                            style={{ marginRight: 'auto' }}
                        >
                            Delete column
                        </button>
                    )}
                    {validationError !== null && (
                        <span className="tertiary" role="alert" style={{ fontSize: 11, color: 'var(--status-failed)', marginRight: 8 }}>
                            {validationError}
                        </span>
                    )}
                    <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
                    <button
                        className="btn primary"
                        type="button"
                        onClick={handleSave}
                        disabled={saving || validationError !== null}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {saving ? 'Saving…' : 'Save & regenerate'}
                    </button>
                </div>
            </div>
        </div>
    );
}
