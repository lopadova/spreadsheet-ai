// ============================================================
// BulkToolbar — bottom toolbar shown when ≥1 AI column is selected on the grid.
// "N selected · Regenerate · Clear selection". Regenerate streams the selected
// AI columns via runColumns(); Clear deselects.
// ============================================================

export interface BulkToolbarProps {
    /** Unique AI column_indexes currently selected. */
    selectedColumns: number[];
    onRegenerate: () => void;
    onClear: () => void;
}

export function BulkToolbar({ selectedColumns, onRegenerate, onClear }: BulkToolbarProps) {
    const n = selectedColumns.length;
    if (n === 0) return null;
    return (
        <div className="bulk-toolbar" role="toolbar" aria-label="Bulk actions" data-testid="bulk-toolbar">
            <span className="bulk-count">
                <b>{n}</b> {n === 1 ? 'colonna selezionata' : 'colonne selezionate'}
            </span>
            <span className="divider-v" aria-hidden="true" />
            <button className="btn sm primary" type="button" onClick={onRegenerate}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
                </svg>
                Regenerate
            </button>
            <button className="btn sm ghost" type="button" onClick={onClear}>
                Clear selection
            </button>
        </div>
    );
}
