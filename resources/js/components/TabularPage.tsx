import { useEffect, useMemo, useState } from 'react';
import { TopChrome, type Theme } from './TopChrome';
import { HeroBanner } from './HeroBanner';
import { PresetChips } from './PresetChips';
import { ActionBar, type RunProgress } from './ActionBar';
import { GridPlaceholder } from './GridPlaceholder';
import { StatusFooter } from './StatusFooter';
import { useToast } from './ToastProvider';
import { useReview, useSuggestions } from '../hooks/useReview';
import { useCellStore } from '../store/cells';
import { sharedCellStore } from '../store/sharedCellStore';
import { computeHeroStats } from '../lib/stats';
import { DEFAULT_PRESET, presetMeta } from '../lib/presets';
import type { Suggestion } from '../api/client';

const EMPTY_PROGRESS: RunProgress = { done: 0, total: 0 };

export function TabularPage() {
    const [theme, setTheme] = useState<Theme>('dark');
    const [preset, setPreset] = useState<string>(DEFAULT_PRESET);
    const [liveMode, setLiveMode] = useState(false);
    const [running] = useState(false);
    const [progress] = useState<RunProgress>(EMPTY_PROGRESS);

    const toast = useToast();
    const reviewQuery = useReview(preset);
    const suggestQuery = useSuggestions(preset);
    const { cells } = useCellStore(sharedCellStore);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    const meta = presetMeta(preset);
    const data = reviewQuery.data;
    const loading = reviewQuery.isPending;

    const stats = useMemo(
        () => computeHeroStats(data?.rows ?? [], data?.columns ?? []),
        [data],
    );

    const onPickSuggestion = (s: Suggestion) => {
        // Full picker + generation is M5; here we surface the choice.
        toast.push({ title: 'AI Suggest', body: `Colonna "${s.name}" pronta (M5)` });
    };

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
                    onRun={() => toast.push({ title: 'Run all', body: 'Streaming celle in M4' })}
                    onStop={() => undefined}
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
                    <GridPlaceholder
                        baseColumns={data?.base_columns ?? []}
                        columns={data?.columns ?? []}
                        rowCount={data?.rows.length ?? 0}
                        loading={loading}
                    />
                )}
                <StatusFooter preset={meta} rowCount={data?.rows.length ?? 0} cells={cells} />
            </div>
        </div>
    );
}
