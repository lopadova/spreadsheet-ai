// ============================================================
// SSE consumer + run controller.
//
// - ONE EventSource per run (article §10): on `event: cell` write to the cell
//   store and atomically repaint via gridRef.updateCells; on `event: done`
//   close + finish.
// - Run-token guard (§1.A.7): each run captures a token; if the preset/review
//   changes (token bumped) or stop() is called, late events are ignored and the
//   stream is closed — no stale cell can bleed into a new preset.
// - Targeted cells are marked `generating` at start so the grid shows skeletons.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataEditorRef } from '@glideapps/glide-data-grid';
import { streamUrl, type AiColumn, type Cell, type Row } from '../api/client';
import { type SubscribableCellStore } from '../store/cells';
import { applyCellEvent, type SseCellEvent } from './sseReducer';

export interface RunProgress {
    done: number;
    total: number;
}

export interface UseSseGenerationArgs {
    reviewId: number | undefined;
    rows: Row[];
    columns: AiColumn[];
    store: SubscribableCellStore;
    gridRef: React.RefObject<DataEditorRef | null>;
    /**
     * Number of base (display) columns to the left of AI columns — needed to
     * translate an AI column_index into a Glide grid column for updateCells.
     */
    baseColumnCount: number;
    /** Called whenever a cell event lands (for footer/citation refresh). */
    onCell?: (cell: Cell) => void;
}

export interface SseGenerationApi {
    running: boolean;
    progress: RunProgress;
    runAll: () => void;
    runColumns: (indexes: number[]) => void;
    stop: () => void;
}

export function useSseGeneration({
    reviewId,
    rows,
    columns,
    store,
    gridRef,
    baseColumnCount,
    onCell,
}: UseSseGenerationArgs): SseGenerationApi {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<RunProgress>({ done: 0, total: 0 });

    const sourceRef = useRef<EventSource | null>(null);
    const tokenRef = useRef(0);

    const closeStream = useCallback(() => {
        sourceRef.current?.close();
        sourceRef.current = null;
    }, []);

    const stop = useCallback(() => {
        tokenRef.current += 1; // Invalidate in-flight events.
        closeStream();
        setRunning(false);
    }, [closeStream]);

    // Bump the token (and close any stream) whenever the review changes so a
    // mid-run preset switch can't patch stale cells into the new preset.
    useEffect(() => {
        tokenRef.current += 1;
        closeStream();
        setRunning(false);
        setProgress({ done: 0, total: 0 });
    }, [reviewId, closeStream]);

    useEffect(() => () => stop(), [stop]);

    const start = useCallback(
        (targetIndexes: number[]) => {
            if (reviewId == null || rows.length === 0 || targetIndexes.length === 0) return;

            // New run token; abort any previous stream.
            closeStream();
            const token = ++tokenRef.current;

            const total = rows.length * targetIndexes.length;
            setProgress({ done: 0, total });
            setRunning(true);

            // Mark every targeted cell `generating` → grid shows skeletons.
            for (const row of rows) {
                for (const colIndex of targetIndexes) {
                    store.set({
                        row_id: row.row_id,
                        column_index: colIndex,
                        content: null,
                        flag: null,
                        confidence: null,
                        status: 'generating',
                    });
                }
            }
            // Repaint affected columns once up front.
            gridRef.current?.updateCells(
                rows.flatMap((_row, rowIdx) =>
                    targetIndexes.map((colIndex) => ({
                        cell: [baseColumnCount + columnGridOffset(columns, colIndex), rowIdx] as [number, number],
                    })),
                ),
            );

            const src = new EventSource(streamUrl(reviewId, { cols: targetIndexes, force: true }));
            sourceRef.current = src;

            src.addEventListener('cell', (e: MessageEvent) => {
                let ev: SseCellEvent;
                try {
                    ev = JSON.parse(e.data) as SseCellEvent;
                } catch {
                    return;
                }
                const key = applyCellEvent({
                    store,
                    ev,
                    eventToken: token,
                    activeToken: tokenRef.current,
                });
                if (key == null) return; // stale run

                // Atomic per-cell repaint.
                const gridCol = baseColumnCount + columnGridOffset(columns, ev.column_index);
                const rowIdx = rows.findIndex((r) => r.row_id === ev.row_id);
                if (rowIdx >= 0) {
                    gridRef.current?.updateCells([{ cell: [gridCol, rowIdx] }]);
                }
                setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) }));
                onCell?.(store.getByKey(key) as Cell);
            });

            src.addEventListener('done', () => {
                if (token !== tokenRef.current) return;
                closeStream();
                setRunning(false);
            });

            src.onerror = () => {
                if (token !== tokenRef.current) return;
                // Stream ended/aborted — settle the run rather than hang.
                closeStream();
                setRunning(false);
            };
        },
        [reviewId, rows, columns, store, gridRef, baseColumnCount, closeStream, onCell],
    );

    const runAll = useCallback(() => {
        start(columns.map((c) => c.index));
    }, [start, columns]);

    const runColumns = useCallback(
        (indexes: number[]) => {
            start(indexes);
        },
        [start],
    );

    return { running, progress, runAll, runColumns, stop };
}

/**
 * Translate an AI column's `index` (its stable column_index) into its 0-based
 * position among the AI columns currently displayed, so we can compute the
 * Glide grid column. Falls back to the raw index.
 */
function columnGridOffset(columns: AiColumn[], columnIndex: number): number {
    const pos = columns.findIndex((c) => c.index === columnIndex);
    return pos >= 0 ? pos : columnIndex;
}
