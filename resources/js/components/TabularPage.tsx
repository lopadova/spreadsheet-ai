import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataEditorRef, GridSelection } from '@glideapps/glide-data-grid';
import { CompactSelection } from '@glideapps/glide-data-grid';
import { TopChrome, type Theme } from './TopChrome';
import { HeroBanner } from './HeroBanner';
import { PresetChips } from './PresetChips';
import { ActionBar } from './ActionBar';
import { StatusFooter } from './StatusFooter';
import { ColumnEditor, type ColumnEditorMode } from './ColumnEditor';
import { CellSidePanel, type CellSelection } from './CellSidePanel';
import { BulkToolbar } from './BulkToolbar';
import { useToast } from './ToastProvider';
import {
    useAddColumn,
    useDeleteColumn,
    useReview,
    useSuggestions,
    useUpdateColumn,
} from '../hooks/useReview';
import { useCellStore } from '../store/cells';
import { sharedCellStore } from '../store/sharedCellStore';
import { computeHeroStats } from '../lib/stats';
import { DEFAULT_PRESET, presetMeta } from '../lib/presets';
import { AgenticGrid } from '../grid/AgenticGrid';
import { useSseGeneration } from '../grid/useSseGeneration';
import { selectedAiColumnIndexes } from '../grid/selection';
import type { AiColumn, ColumnInput, ReviewResponse, Suggestion } from '../api/client';

const EMPTY_SELECTION: GridSelection = {
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
};

/** Highest AI-column index in a review payload (the just-appended column). */
function lastColumnIndex(review: ReviewResponse): number {
    return review.columns.reduce((max, c) => Math.max(max, c.index), -1);
}

export function TabularPage() {
    const [theme, setTheme] = useState<Theme>('dark');
    const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
    const [liveMode, setLiveMode] = useState(false);
    const [themeVersion, setThemeVersion] = useState(0);

    // Column editor drawer.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<ColumnEditorMode>('new');
    const [editorColumn, setEditorColumn] = useState<AiColumn | null>(null);

    // Cell side-panel.
    const [cellSel, setCellSel] = useState<CellSelection | null>(null);

    // Grid selection (controlled) for bulk regenerate.
    const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION);

    const toast = useToast();
    const reviewQuery = useReview(preset);
    const suggestQuery = useSuggestions(preset);
    const { cells } = useCellStore(sharedCellStore);

    const gridRef = useRef<DataEditorRef | null>(null);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        setThemeVersion((v) => v + 1);
    }, [theme]);

    const meta = presetMeta(preset);
    const data = reviewQuery.data;
    const loading = reviewQuery.isPending;
    const reviewId = data?.review.id;

    const rows = useMemo(() => data?.rows ?? [], [data]);
    const aiColumns = useMemo(() => data?.columns ?? [], [data]);
    const baseColumns = useMemo(() => data?.base_columns ?? [], [data]);

    const stats = useMemo(() => computeHeroStats(rows, aiColumns), [rows, aiColumns]);

    const { running, progress, runAll, runColumns, stop } = useSseGeneration({
        reviewId,
        rows,
        columns: aiColumns,
        store: sharedCellStore,
        gridRef,
        baseColumnCount: baseColumns.length,
    });

    const addColumn = useAddColumn(preset, reviewId);
    const updateColumn = useUpdateColumn(preset, reviewId);
    const deleteColumn = useDeleteColumn(preset, reviewId);

    // After an add/update mutation resolves, the review refetches and
    // `aiColumns` gains the new/edited column. We stash the target index here
    // and fire runColumns([index]) once that index is actually present.
    const pendingRegenRef = useRef<number | null>(null);
    useEffect(() => {
        const idx = pendingRegenRef.current;
        if (idx == null) return;
        if (aiColumns.some((c) => c.index === idx)) {
            pendingRegenRef.current = null;
            runColumns([idx]);
        }
    }, [aiColumns, runColumns]);

    // ---- Column editor ------------------------------------------------
    const openNewColumn = useCallback(() => {
        setEditorMode('new');
        setEditorColumn(null);
        setEditorOpen(true);
    }, []);

    const openEditColumn = useCallback((col: AiColumn) => {
        setEditorMode('edit');
        setEditorColumn(col);
        setEditorOpen(true);
    }, []);

    const handleEditorSubmit = useCallback(
        (payload: ColumnInput, mode: ColumnEditorMode, index?: number) => {
            if (mode === 'edit' && index != null) {
                updateColumn.mutate(
                    { index, col: payload },
                    {
                        onSuccess: () => {
                            pendingRegenRef.current = index;
                            toast.push({ title: 'Colonna aggiornata', body: payload.name });
                        },
                    },
                );
            } else {
                addColumn.mutate(payload, {
                    onSuccess: (review) => {
                        // Derive the new column's index from the returned payload
                        // (robust to prior deletes), not from a stale local count.
                        pendingRegenRef.current = lastColumnIndex(review);
                        toast.push({ title: 'Colonna aggiunta', body: payload.name });
                    },
                });
            }
            setEditorOpen(false);
        },
        [addColumn, updateColumn, toast],
    );

    const handleEditorDelete = useCallback(
        (index: number) => {
            deleteColumn.mutate(index, {
                onSuccess: () => toast.push({ title: 'Colonna eliminata', body: `col ${index}` }),
            });
            setEditorOpen(false);
            // Close the side-panel if it was pointing at the deleted column.
            setCellSel((s) => (s?.columnIndex === index ? null : s));
        },
        [deleteColumn, toast],
    );

    // ---- AI Suggest ---------------------------------------------------
    const onPickSuggestion = useCallback(
        (s: Suggestion) => {
            addColumn.mutate(
                {
                    name: s.name,
                    format: s.format,
                    prompt: s.prompt,
                    enum_values: s.enum_values,
                },
                {
                    onSuccess: (review) => {
                        pendingRegenRef.current = lastColumnIndex(review);
                        toast.push({ title: 'AI Suggest', body: `Colonna "${s.name}" aggiunta` });
                    },
                },
            );
        },
        [addColumn, toast],
    );

    // ---- Cell side-panel ----------------------------------------------
    const onCellClicked = useCallback((rowId: string, columnIndex: number) => {
        setCellSel({ rowId, columnIndex });
    }, []);

    // Read via the reactive `cells` map so a regenerate re-stream re-renders the
    // panel (a direct store.get() during render wouldn't subscribe to updates).
    const selectedCell = cellSel
        ? cells.get(`${cellSel.rowId}:${cellSel.columnIndex}`)
        : undefined;
    const selectedColumn = cellSel
        ? aiColumns.find((c) => c.index === cellSel.columnIndex)
        : undefined;

    // ---- Bulk selection ----------------------------------------------
    const bulkColumns = useMemo(
        () => selectedAiColumnIndexes(gridSelection, aiColumns, baseColumns.length),
        [gridSelection, aiColumns, baseColumns.length],
    );

    const clearSelection = useCallback(() => setGridSelection(EMPTY_SELECTION), []);

    // Keyboard-accessible mirror of canvas column-select: toggle a whole AI
    // column in/out of the selection. Drives both the canvas highlight and the
    // bulk toolbar.
    const toggleColumnSelect = useCallback((gridColumn: number) => {
        setGridSelection((prev) => {
            const has = prev.columns.hasIndex(gridColumn);
            return {
                ...prev,
                columns: has
                    ? prev.columns.remove(gridColumn)
                    : prev.columns.add(gridColumn),
            };
        });
    }, []);

    const selectedGridColumns = useMemo(
        () => new Set(gridSelection.columns.toArray()),
        [gridSelection],
    );

    const regenerateBulk = useCallback(() => {
        if (bulkColumns.length > 0) runColumns(bulkColumns);
    }, [bulkColumns, runColumns]);

    return (
        <div className="page-root">
            <TopChrome theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
            <div className="page-content">
                <HeroBanner stats={stats} loading={loading} />
                <PresetChips active={preset} onPick={setPreset} />
                <ActionBar
                    onAddColumn={openNewColumn}
                    onExport={() => toast.push({ title: 'Export XLSX', body: 'Export simulato — demo' })}
                    onShare={() => toast.push({ title: 'Share', body: 'Share simulato — demo' })}
                    onRun={runAll}
                    onStop={stop}
                    onPickSuggestion={onPickSuggestion}
                    running={running}
                    progress={progress}
                    liveMode={liveMode}
                    onToggleLiveMode={() => setLiveMode((v) => !v)}
                    suggestions={suggestQuery.data?.suggestions ?? []}
                    suggestionsLoading={suggestQuery.isPending}
                />
                {reviewQuery.isError ? (
                    <div className="empty" role="alert">
                        Impossibile caricare il preset. Verifica che il database sia seeded.
                    </div>
                ) : (
                    <AgenticGrid
                        preset={preset}
                        baseColumns={baseColumns}
                        columns={aiColumns}
                        rows={rows}
                        store={sharedCellStore}
                        gridRef={gridRef}
                        loading={loading}
                        onEditColumn={openEditColumn}
                        onCellClicked={onCellClicked}
                        gridSelection={gridSelection}
                        onGridSelectionChange={setGridSelection}
                        onToggleColumnSelect={toggleColumnSelect}
                        selectedGridColumns={selectedGridColumns}
                        themeVersion={themeVersion}
                    />
                )}
                <StatusFooter preset={meta} rowCount={rows.length} cells={cells} />
            </div>

            <BulkToolbar
                selectedColumns={bulkColumns}
                onRegenerate={regenerateBulk}
                onClear={clearSelection}
            />

            <ColumnEditor
                open={editorOpen}
                mode={editorMode}
                column={editorColumn}
                onSubmit={handleEditorSubmit}
                onDelete={handleEditorDelete}
                onClose={() => setEditorOpen(false)}
                saving={addColumn.isPending || updateColumn.isPending}
            />

            <CellSidePanel
                open={cellSel != null}
                selection={cellSel}
                cell={selectedCell}
                column={selectedColumn}
                onClose={() => setCellSel(null)}
                onRegenerate={(columnIndex) => runColumns([columnIndex])}
            />
        </div>
    );
}
