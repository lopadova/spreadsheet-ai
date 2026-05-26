import { useEffect, useRef, useState } from 'react';
import type { Suggestion } from '../api/client';

export interface RunProgress {
    done: number;
    total: number;
}

interface ActionBarProps {
    onAddColumn: () => void;
    onExport: () => void;
    onShare: () => void;
    onRun: () => void;
    onStop: () => void;
    onPickSuggestion: (s: Suggestion) => void;
    running: boolean;
    progress: RunProgress;
    liveMode: boolean;
    onToggleLiveMode: () => void;
    suggestions: Suggestion[];
    suggestionsLoading?: boolean;
}

function SparkleIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
            <path d="M18.5 14l.9 2.4 2.1.6-2.1.8-.9 2.2-.9-2.2-2.1-.8 2.1-.6.9-2.4z" opacity=".7" />
        </svg>
    );
}

export function ActionBar({
    onAddColumn,
    onExport,
    onShare,
    onRun,
    onStop,
    onPickSuggestion,
    running,
    progress,
    liveMode,
    onToggleLiveMode,
    suggestions,
    suggestionsLoading = false,
}: ActionBarProps) {
    const [popOpen, setPopOpen] = useState(false);
    const aiBtnRef = useRef<HTMLButtonElement>(null);
    const pct = progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;

    useEffect(() => {
        if (!popOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPopOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [popOpen]);

    return (
        <div className="action-bar">
            <div className="action-bar-left">
                <button
                    ref={aiBtnRef}
                    className="btn ai-suggest-btn"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={popOpen}
                    onClick={() => setPopOpen((v) => !v)}
                >
                    <SparkleIcon />
                    <span>AI Suggest</span>
                    <span className="ai-suggest-shine" aria-hidden="true" />
                </button>
                <button className="btn" type="button" onClick={onAddColumn}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add column
                </button>
                <span className="divider-v" aria-hidden="true" />
                <button
                    className={`llm-toggle ${liveMode ? 'on' : 'off'}`}
                    type="button"
                    onClick={onToggleLiveMode}
                    aria-pressed={liveMode}
                    title={liveMode ? 'Live mode · calls the LLM' : 'Mock mode · no API calls'}
                >
                    <span className="llm-toggle-dot" aria-hidden="true" />
                    <span className="llm-toggle-text">
                        {liveMode ? (
                            <>
                                <b>Live LLM</b>
                                <small className="mono">claude-haiku-4.5</small>
                            </>
                        ) : (
                            <>
                                <b>Mock mode</b>
                                <small className="mono">no API calls</small>
                            </>
                        )}
                    </span>
                </button>
            </div>
            <div className="action-bar-right">
                {running ? (
                    <div className="run-progress">
                        <span className="badge running">
                            <span className="dot" />
                            Generating · {progress.done}/{progress.total}
                        </span>
                        <div
                            className="run-progress-bar"
                            role="progressbar"
                            aria-valuenow={Math.round(pct)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div className="run-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <button className="btn sm danger" type="button" onClick={onStop}>
                            Stop
                        </button>
                    </div>
                ) : (
                    <>
                        <button className="btn" type="button" onClick={onExport}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Export XLSX
                        </button>
                        <button className="btn" type="button" onClick={onShare}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                            </svg>
                            Share
                        </button>
                        <button className="btn primary" type="button" onClick={onRun}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            Run all
                        </button>
                    </>
                )}
            </div>

            {popOpen && (
                <>
                    <div className="popover-veil" onClick={() => setPopOpen(false)} />
                    <div
                        className="popover ai-suggest-pop"
                        role="menu"
                        aria-label="AI suggested columns"
                        style={{ top: 96, left: 32 }}
                    >
                        <div className="popover-head">
                            <SparkleIcon />
                            <b style={{ fontSize: 12.5 }}>Colonne suggerite</b>
                        </div>
                        <div className="popover-list">
                            {suggestionsLoading && <div className="empty">Caricamento…</div>}
                            {!suggestionsLoading && suggestions.length === 0 && (
                                <div className="empty">Nessun suggerimento</div>
                            )}
                            {!suggestionsLoading &&
                                suggestions.map((s) => (
                                    <button
                                        key={s.name}
                                        type="button"
                                        role="menuitem"
                                        className="popover-item"
                                        onClick={() => {
                                            onPickSuggestion(s);
                                            setPopOpen(false);
                                        }}
                                    >
                                        <SparkleIcon />
                                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <b style={{ fontSize: 12.5 }}>{s.name}</b>
                                            <small className="tertiary mono" style={{ fontSize: 10.5 }}>
                                                {s.format}
                                            </small>
                                        </span>
                                    </button>
                                ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
