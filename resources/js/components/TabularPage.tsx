import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataEditorRef } from '@glideapps/glide-data-grid';
import { TopChrome, type Theme } from './TopChrome';
import { HeroBanner } from './HeroBanner';
import { PresetChips } from './PresetChips';
import { ActionBar } from './ActionBar';
import { StatusFooter } from './StatusFooter';
import { useToast } from './ToastProvider';
import { useReview, useSuggestions } from '../hooks/useReview';
import { useCellStore } from '../store/cells';
import { sharedCellStore } from '../store/sharedCellStore';
import { computeHeroStats } from '../lib/stats';
import { DEFAULT_PRESET, presetMeta } from '../lib/presets';
import { AgenticGrid } from '../grid/AgenticGrid';
import { useSseGeneration } from '../grid/useSseGeneration';
import type { AiColumn, Suggestion } from '../api/client';

export function TabularPage() {
    const [theme, setTheme] = useState<Theme>('dark');
    const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
    const [liveMode, setLiveMode] = useState(false);
    const [themeVersion, setThemeVersion] = useState(0);

    const toast = useToast();
    const reviewQuery = useReview(preset);
    const suggestQuery = useSuggestions(preset);
    const { cells } = useCellStore(sharedCellStore);

    const gridRef = useRef<DataEditorRef | null>(null);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        // Bump so the grid rebuilds its theme from the new CSS tokens.
        setThemeVersion((v) => v + 1);
    }, [theme]);

    const meta = presetMeta(preset);
    const data = reviewQuery.data;
    const loading = reviewQuery.isPending;

    const rows = useMemo(() => data?.rows ?? [], [data]);
    const aiColumns = useMemo(() => data?.columns ?? [], [data]);
    const baseColumns = useMemo(() => data?.base_columns ?? [], [data]);

    const stats = useMemo(
        () => computeHeroStats(rows, aiColumns),
        [rows, aiColumns],
    );

    const { running, progress, runAll, stop } = useSseGeneration({
        reviewId: data?.review.id,
        rows,
        columns: aiColumns,
        store: sharedCellStore,
        gridRef,
        baseColumnCount: baseColumns.length,
    });

    const onPickSuggestion = useCallback(
        (s: Suggestion) => {
            // Full picker + generation is M5; here we surface the choice.
            toast.push({ title: 'AI Suggest', body: `Colonna "${s.name}" pronta (M5)` });
        },
        [toast],
    );

    const onEditColumn = useCallback(
        (col: AiColumn) => {
            toast.push({ title: 'Edit column', body: `Editor "${col.name}" in M5` });
        },
        [toast],
    );

    return (
        <div className="page-root">
            <TopChrome theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
            <div className="page-content">
                <HeroBanner stats={stats} loading={loading} />
                <PresetChips active={preset} onPick={setPreset} />
                <ActionBar
                    onAddColumn={() => toast.push({ title: 'Add column', body: 'Editor colonna in M5' })}
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
                        onEditColumn={onEditColumn}
                        themeVersion={themeVersion}
                    />
                )}
                <StatusFooter preset={meta} rowCount={rows.length} cells={cells} />
            </div>
        </div>
    );
}
