// ============================================================
// Pure SSE reducing logic, isolated for unit testing.
//
// A `cell` event must (a) write to the cell store at the correct key and (b)
// only count toward progress / repaint when its run-token matches the active
// run (fixes prototype bug §1.A.7: a preset switch mid-run must NOT patch stale
// cells into the new preset).
// ============================================================

import type { Cell } from '../api/client';
import { cellKey, type SubscribableCellStore } from '../store/cells';

export interface SseProgress {
    done: number;
    total: number;
}

/** Parsed `cell` SSE payload (matches StreamController::emit). */
export interface SseCellEvent {
    row_id: string;
    column_index: number;
    content: Cell['content'];
    flag: string | null;
    confidence: number | null;
    status: string;
}

export function eventToCell(ev: SseCellEvent): Cell {
    return {
        row_id: ev.row_id,
        column_index: ev.column_index,
        content: ev.content,
        flag: ev.flag,
        confidence: ev.confidence,
        status: ev.status,
    };
}

export interface ApplyCellArgs {
    store: SubscribableCellStore;
    ev: SseCellEvent;
    /** Token attached to the EventSource that delivered this event. */
    eventToken: number;
    /** Token of the run currently considered active. */
    activeToken: number;
}

/**
 * Apply an incoming cell event. Returns the store key written, or `null` when
 * the event was ignored because its run-token is stale (preset/review changed).
 */
export function applyCellEvent({ store, ev, eventToken, activeToken }: ApplyCellArgs): string | null {
    if (eventToken !== activeToken) {
        return null; // Stale run — drop silently. (§1.A.7)
    }
    const key = cellKey(ev.row_id, ev.column_index);
    store.set(eventToCell(ev));
    return key;
}

/** Clamp progress and compute a 0..100 percentage. */
export function progressPercent(p: SseProgress): number {
    if (p.total <= 0) return 0;
    return Math.min(100, Math.max(0, (p.done / p.total) * 100));
}
